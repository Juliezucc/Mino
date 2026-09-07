/**
 * The child's unit of screen time.
 *
 * Children never see "minutes" — they see **minos**. Parents keep seeing
 * minutes, because a parent is deciding how much real screen time to hand out
 * and that decision has to be in real units.
 *
 * THE RULE, and it is not negotiable: **1 mino = 1 minute, always.**
 *
 * A mino is a name, not a currency. The moment the rate stops being 1:1, or a
 * mino buys anything other than the time it names, Mino has invented a virtual
 * currency aimed at children — which the product brief rules out, and which
 * drags a consumer-protection problem in behind it. Minos are earned by
 * completing missions and spent on screen time. They are never sold, never
 * bought, never converted, and never expire into something else.
 *
 * So the ledger, the domain, and the parent app all stay in minutes. This
 * module exists only to put the child's word on that number.
 */

/** Not a tunable. See the rule above. */
export const MINUTES_PER_MINO = 1;

export const MINO_UNIT = 'mino';
export const MINO_UNIT_PLURAL = 'minos';

/** Minutes as stored in the ledger → minos as shown to the child. */
export function toMinos(minutes: number): number {
  return minutes / MINUTES_PER_MINO;
}

/** Minos a child typed or tapped → minutes to store. */
export function toMinutes(minos: number): number {
  return minos * MINUTES_PER_MINO;
}

/** The unit word, agreeing with the number: "1 mino", "15 minos". */
export function minoUnit(minos: number): string {
  return Math.abs(minos) < 2 ? MINO_UNIT : MINO_UNIT_PLURAL;
}

interface FormatOptions {
  /** Show a "+" in front of a gain, as on the reward pills. */
  signed?: boolean;
}

/** "15 minos", "+15 minos", "1 mino". */
export function formatMinos(minutes: number, { signed = false }: FormatOptions = {}): string {
  const value = Math.round(toMinos(minutes));
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${value} ${minoUnit(value)}`;
}

export type TimeUnit = 'minos' | 'minutes';

/**
 * One formatter for both registers, so a screen carries the unit it was given
 * rather than deciding on the spot and drifting from its neighbours.
 */
export function formatTime(
  minutes: number,
  unit: TimeUnit,
  { signed = false }: FormatOptions = {},
): string {
  if (unit === 'minos') return formatMinos(minutes, { signed });
  const value = Math.round(minutes);
  return `${signed && value > 0 ? '+' : ''}${value} min`;
}

/** The unit word alone: "minos", "min". */
export function unitLabel(minutes: number, unit: TimeUnit): string {
  return unit === 'minos' ? minoUnit(Math.round(minutes)) : 'min';
}

/**
 * Entre combien et combien un enfant peut demander du temps.
 *
 * L'écran proposait trois durées figées — 10, 20, 30 — filtrées par le solde.
 * Avec quinze minutes gagnées, seul « 10 » restait, et les cinq autres étaient
 * indépensables. Corriger la liste ne suffisait pas : le principe même était
 * faux. Un solde est un nombre quelconque, et un enfant qui a sept minutes
 * doit pouvoir en prendre sept.
 *
 * Le plancher est cinq minutes — en dessous, une séance ne vaut pas le geste —
 * **sauf quand le solde est plus petit**, auquel cas le plancher, c'est le
 * solde. Sinon un enfant avec trois minutes n'aurait de nouveau rien à prendre,
 * et on aurait reproduit le défaut en le déplaçant.
 */
export const SEANCE_MINIMALE = 5;

export function bornesPour(solde: number): { min: number; max: number } | null {
  if (solde <= 0) return null;
  return { min: Math.min(SEANCE_MINIMALE, solde), max: solde };
}
