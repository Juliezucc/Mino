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
 * Les paliers ronds proposés à l'enfant pour dépenser son temps.
 *
 * Trois valeurs commodes, et rien de plus : dix, vingt, trente.
 */
export const PALIERS = [10, 20, 30];

/**
 * Ce qu'un enfant peut réellement demander, et **toujours** son solde entier.
 *
 * L'écran filtrait les paliers par le solde : `PALIERS.filter(p => p <= solde)`.
 * Avec 15 minutes gagnées, seul `10` survivait — et les cinq autres devenaient
 * inatteignables. L'enfant les voyait affichées, comptées, gagnées, et ne
 * pouvait pas les prendre tant qu'il n'atteignait pas vingt.
 *
 * Ce n'est pas un détail d'interface. Tout le produit repose sur une promesse
 * tenue à la minute près : ce que tu gagnes est à toi. Un reliquat qu'on ne
 * peut pas dépenser est une promesse retirée en silence — et l'enfant qui
 * compte s'en aperçoit avant nous.
 *
 * D'où : les paliers strictement en dessous du solde, puis le solde lui-même.
 * 15 → 10 et 15. 45 → 10, 20, 30 et 45. 7 → 7. Rien du tout à zéro, plutôt
 * qu'une pastille « 0 mino » qui inviterait à démarrer une séance vide.
 */
export function dureesPour(solde: number): number[] {
  if (solde <= 0) return [];
  return [...PALIERS.filter((palier) => palier < solde), solde];
}
