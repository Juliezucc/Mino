import {
  Child,
  FamilyData,
  ID,
  ISODate,
  MissionCompletion,
  ScreenTimeBalance,
  ScreenTimeTransaction,
} from './types';

/** Balance of a child = sum of every transaction. No mutable counter, ever. */
export function balanceOf(transactions: ScreenTimeTransaction[], childId: ID): number {
  return transactions.reduce((sum, tx) => (tx.childId === childId ? sum + tx.delta : sum), 0);
}

/**
 * Folds the history a device did not download into one opening line per child.
 *
 * A device carries only the recent ledger, but the balance must stay exactly
 * the sum of what it holds — the app has one rule about time and this is it.
 * So for each child the server's true total is compared with the total of the
 * lines actually present, and the difference becomes a single dated entry.
 *
 * The invariant that matters: after this call,
 * `balanceOf(result, childId) === trueBalance[childId]`, whatever was truncated.
 */
export function withOpeningBalances(
  recent: ScreenTimeTransaction[],
  trueBalance: Record<ID, number>,
  familyId: ID,
  before: ISODate,
): ScreenTimeTransaction[] {
  const opening: ScreenTimeTransaction[] = [];

  for (const [childId, total] of Object.entries(trueBalance)) {
    const carried = balanceOf(recent, childId);
    const delta = total - carried;
    if (delta === 0) continue;

    opening.push({
      id: `opening-${childId}`,
      familyId,
      childId,
      delta,
      kind: 'initial_balance',
      reason: 'Total des minutes avant cette période',
      // Dated one second before the window so it always sorts last in history.
      createdAt: new Date(new Date(before).getTime() - 1000).toISOString(),
    });
  }

  return [...recent, ...opening];
}

export function isSameDay(a: ISODate | Date, b: ISODate | Date): boolean {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function balanceDetail(
  transactions: ScreenTimeTransaction[],
  childId: ID,
  now: Date = new Date(),
): ScreenTimeBalance {
  let minutes = 0;
  let earnedToday = 0;
  let usedToday = 0;

  for (const tx of transactions) {
    if (tx.childId !== childId) continue;
    minutes += tx.delta;
    if (isSameDay(tx.createdAt, now)) {
      if (tx.delta > 0) earnedToday += tx.delta;
      else usedToday += -tx.delta;
    }
  }

  return { childId, minutes, earnedToday, usedToday, updatedAt: now.toISOString() };
}

/** Ledger entries for one child, newest first — this is the history screen. */
export function historyOf(
  transactions: ScreenTimeTransaction[],
  childId: ID,
): ScreenTimeTransaction[] {
  return transactions
    .filter((tx) => tx.childId === childId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function pendingCompletions(data: FamilyData): MissionCompletion[] {
  return data.completions
    .filter((c) => c.status === 'pending')
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export function pendingCompletionsForChild(data: FamilyData, childId: ID): MissionCompletion[] {
  return pendingCompletions(data).filter((c) => c.childId === childId);
}

/** Approved completions the child has not celebrated yet (drives the celebration screen). */
export function uncelebratedCompletions(data: FamilyData, childId: ID): MissionCompletion[] {
  return data.completions
    .filter((c) => c.childId === childId && c.status === 'approved' && !c.celebratedAt)
    .sort((a, b) => (a.reviewedAt ?? '').localeCompare(b.reviewedAt ?? ''));
}

/** Ce qu'une célébration montre : tout ce qui attend, et le total gagné. */
export interface Celebration {
  completions: MissionCompletion[];
  minutes: number;
}

/**
 * Une seule célébration pour tout ce qui attend.
 *
 * **Le défaut que cela répare.** L'écran ne savait fêter qu'une complétion à la
 * fois, et la zone enfant en ouvrait un par complétion en attente. Un parent
 * qui rentre le soir et confirme les huit missions de la journée d'un coup
 * produisait donc huit écrans de confettis empilés, à refermer un par un. Le
 * premier fait plaisir ; le troisième est un obstacle entre l'enfant et son
 * temps d'écran.
 *
 * Le total est calculé ici plutôt que dans l'écran pour une raison simple :
 * c'est le chiffre que l'enfant lit en grand, et c'est le seul de toute
 * l'application qui doive être exactement la somme de ce qui vient de tomber.
 *
 * `focus` sert le cas d'une mission qui se compte toute seule : l'écran s'ouvre
 * sur elle à l'instant même où elle est créée, parfois avant que la liste ne
 * l'ait reprise.
 */
export function celebrationFor(data: FamilyData, childId: ID, focus?: ID): Celebration {
  const attente = uncelebratedCompletions(data, childId);
  const nomme = focus ? data.completions.find((c) => c.id === focus) : undefined;

  const completions =
    nomme && nomme.childId === childId && !attente.some((c) => c.id === nomme.id)
      ? [...attente, nomme]
      : attente;

  return {
    completions,
    minutes: completions.reduce((sum, c) => sum + (c.minutesAwarded ?? 0), 0),
  };
}

export function childById(data: FamilyData, childId: ID): Child | undefined {
  return data.children.find((c) => c.id === childId);
}

/** 35 → "35:00". The child screen always shows minutes:seconds. */
export function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  return `${safe}:00`;
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 1 capsule = 5 minutes — the visual unit a child can count without reading. */
export const MINUTES_PER_CAPSULE = 5;

export function capsulesFor(minutes: number): { full: number; partial: number } {
  const safe = Math.max(0, minutes);
  return {
    full: Math.floor(safe / MINUTES_PER_CAPSULE),
    partial: (safe % MINUTES_PER_CAPSULE) / MINUTES_PER_CAPSULE,
  };
}
