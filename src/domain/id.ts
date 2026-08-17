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

/** Family code shown to a parent so a child device can join: e.g. "MINO-7K2Q". */
export function createFamilyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return `MINO-${out}`;
}
