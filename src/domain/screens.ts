/**
 * What the earned time is actually spent on.
 *
 * Not every screen a family owns can be measured by software. A tablet running
 * Mino can: the app is there, it counts. A Nintendo Switch, a television, the
 * family desktop cannot — none of them exposes an interface a third-party app
 * may drive, and pretending otherwise would mean a counter that quietly lies.
 *
 * So there are two kinds of screen, and the difference is only ever about WHO
 * runs the clock:
 *
 *  - `managed`  — Mino runs the timer itself, on the device it is installed on.
 *  - `supervised` — the child asks, a parent agrees and starts it, and the
 *    parent closes it. The countdown is visible on both sides so nobody has to
 *    keep it in their head.
 *
 * Both debit the exact same ledger, in the same unit, with the same rule: only
 * the time actually elapsed is billed.
 */

export type ScreenTargetKind = 'device' | 'console' | 'tv' | 'computer';

export type ScreenTargetMode = 'managed' | 'supervised';

export interface ScreenTarget {
  kind: ScreenTargetKind;
  label: string;
  /** The label inside a sentence: "20 minos sur la console". */
  spoken: string;
  icon: string;
  mode: ScreenTargetMode;
  /** Shown to the child under the choice, so the deal is never a surprise. */
  hint: string;
}

export const SCREEN_TARGETS: ScreenTarget[] = [
  {
    kind: 'device',
    label: 'Cet appareil',
    spoken: 'cet appareil',
    icon: '📱',
    mode: 'managed',
    hint: 'Le minuteur démarre tout de suite.',
  },
  {
    kind: 'console',
    label: 'Console',
    spoken: 'la console',
    icon: '🎮',
    mode: 'supervised',
    hint: 'Switch, PlayStation, Xbox… un parent lance le minuteur.',
  },
  {
    kind: 'tv',
    label: 'Télévision',
    spoken: 'la télévision',
    icon: '📺',
    mode: 'supervised',
    hint: 'Un parent lance le minuteur.',
  },
  {
    kind: 'computer',
    label: 'Ordinateur',
    spoken: 'l’ordinateur',
    icon: '💻',
    mode: 'supervised',
    hint: 'Un parent lance le minuteur.',
  },
];

export function targetFor(kind: ScreenTargetKind | undefined): ScreenTarget {
  return SCREEN_TARGETS.find((t) => t.kind === kind) ?? SCREEN_TARGETS[0];
}

export function isSupervised(kind: ScreenTargetKind | undefined): boolean {
  return targetFor(kind).mode === 'supervised';
}
