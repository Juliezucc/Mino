import { Child } from './types';

/**
 * How old the child is changes what Mino should look like.
 *
 * The same loop works from 5 to 17 — do your part, earn your screen time — but
 * a fourteen-year-old handed confetti, a bouncing mascot and a currency called
 * "minos" closes the app and never opens it again. Being talked down to is the
 * fastest way to lose a teenager.
 *
 * So there are two registers, and one number decides which:
 *
 *  - `enfant` (5–12): minos, mascot, celebration, very large buttons.
 *  - `ado` (13+): minutes, sober wording, no confetti, denser layout.
 *
 * Nothing in the ledger or the domain changes. Only the words and the tone.
 */

export type AgeBand = 'enfant' | 'ado';

/** Where the app switches register. */
export const TEEN_FROM = 13;

/** Oldest profile the app accepts. Past that, a teenager needs no chore app. */
export const MAX_AGE = 17;
export const MIN_AGE = 4;

export function bandForAge(age: number): AgeBand {
  return age >= TEEN_FROM ? 'ado' : 'enfant';
}

export function bandOf(child: Child | null | undefined): AgeBand {
  return child ? bandForAge(child.age) : 'enfant';
}

/** Children count in minos; teenagers count in minutes. */
export function unitFor(band: AgeBand): 'minos' | 'minutes' {
  return band === 'ado' ? 'minutes' : 'minos';
}

export function unitOf(child: Child | null | undefined): 'minos' | 'minutes' {
  return unitFor(bandOf(child));
}

/**
 * The tone knobs, gathered in one place so a screen never has to test the age
 * itself and drift from the others.
 */
export interface Register {
  band: AgeBand;
  unit: 'minos' | 'minutes';
  /** Confetti, a bouncing mascot, "Bravo !". */
  celebrate: boolean;
  /** Oversized child-sized buttons. */
  bigButtons: boolean;
  /** The mascot appears at all. */
  mascot: boolean;
}

export function registerOf(child: Child | null | undefined): Register {
  const band = bandOf(child);
  return {
    band,
    unit: unitFor(band),
    celebrate: band === 'enfant',
    bigButtons: band === 'enfant',
    // The mascot stays for teenagers, but discreetly: it is the brand, not a
    // playmate. Screens use a smaller size and no idle animation.
    mascot: true,
  };
}
