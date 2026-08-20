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

/** Family code shown to a parent so a child device can join: e.g. "MINO-7K2Q". */
export function createFamilyCode(): string {
  return `MINO-${code(4)}`;
}

/**
 * Referral code, deliberately distinct from the family code: one is shared with
 * strangers, the other lets a device join the family. They must never be the
 * same string.
 */
export function createReferralCode(): string {
  return code(6);
}
