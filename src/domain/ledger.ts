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
