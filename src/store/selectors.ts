import { useMemo } from 'react';

import {
  balanceDetail,
  balanceOf,
  historyOf,
  pendingCompletions,
  uncelebratedCompletions,
} from '@/domain/ledger';
import { ChildMission, missionsForChild, prochaineJournee } from '@/domain/missions';
import { Child, FamilyData, ID, ScreenTimeBalance } from '@/domain/types';

import { useMinoStore } from './useMinoStore';

const EMPTY: never[] = [];

export function useFamily(): FamilyData | null {
  return useMinoStore((s) => s.data);
}

export function useChildren(): Child[] {
  return useMinoStore((s) => s.data?.children ?? EMPTY);
}

export function useParent() {
  return useMinoStore((s) => s.data?.parents[0] ?? null);
}

export function useChild(childId: ID | null | undefined): Child | null {
  const children = useChildren();
  return useMemo(
    () => (childId ? children.find((c) => c.id === childId) ?? null : null),
    [children, childId],
  );
}

/** The other children of the family — what makes sibling missions relevant. */
export function useSiblings(childId: ID | null | undefined): Child[] {
  const children = useChildren();
  return useMemo(
    () => (childId ? children.filter((c) => c.id !== childId) : EMPTY),
    [children, childId],
  );
}

export function useActiveChild(): Child | null {
  const activeChildId = useMinoStore((s) => s.activeChildId);
  return useChild(activeChildId);
}

export function useBalance(childId: ID | null | undefined): number {
  const transactions = useMinoStore((s) => s.data?.transactions ?? EMPTY);
  return useMemo(() => (childId ? balanceOf(transactions, childId) : 0), [transactions, childId]);
}

export function useBalanceDetail(childId: ID | null | undefined): ScreenTimeBalance | null {
  const transactions = useMinoStore((s) => s.data?.transactions ?? EMPTY);
  return useMemo(
    () => (childId ? balanceDetail(transactions, childId) : null),
    [transactions, childId],
  );
}

export function useChildMissions(childId: ID | null | undefined): ChildMission[] {
  const data = useFamily();
  return useMemo(
    () => (data && childId ? missionsForChild(data, childId) : EMPTY),
    [data, childId],
  );
}

export function usePendingRequests() {
  const data = useFamily();
  return useMemo(() => (data ? pendingCompletions(data) : EMPTY), [data]);
}

export function useUncelebrated(childId: ID | null | undefined) {
  const data = useFamily();
  return useMemo(
    () => (data && childId ? uncelebratedCompletions(data, childId) : EMPTY),
    [data, childId],
  );
}

export function useHistory(childId: ID | null | undefined) {
  const transactions = useMinoStore((s) => s.data?.transactions ?? EMPTY);
  return useMemo(() => (childId ? historyOf(transactions, childId) : EMPTY), [transactions, childId]);
}

/** The child's pending "can I play on the console?" request, if any. */
export function useRequestedSession(childId: ID | null | undefined) {
  const sessions = useMinoStore((s) => s.data?.sessions ?? EMPTY);
  return useMemo(
    () =>
      childId ? sessions.find((s) => s.childId === childId && s.status === 'requested') ?? null : null,
    [sessions, childId],
  );
}

/** Every child's screen request waiting on a parent, newest first. */
export function useScreenRequests() {
  const sessions = useMinoStore((s) => s.data?.sessions ?? EMPTY);
  return useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'requested')
        .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? '')),
    [sessions],
  );
}

/** Sessions currently running, so a parent can watch and close them. */
export function useRunningSessions() {
  const sessions = useMinoStore((s) => s.data?.sessions ?? EMPTY);
  return useMemo(() => sessions.filter((s) => s.status === 'running'), [sessions]);
}

export function useRunningSession(childId: ID | null | undefined) {
  const sessions = useMinoStore((s) => s.data?.sessions ?? EMPTY);
  return useMemo(
    () => (childId ? sessions.find((s) => s.childId === childId && s.status === 'running') ?? null : null),
    [sessions, childId],
  );
}

/**
 * Ce qui attend cet enfant, quand rien ne l'attend aujourd'hui.
 *
 * Voir `prochaineJournee` : cinq routines sur douze ne tournent pas tous les
 * jours, et un enfant à qui l'on annonce « pas encore de mission » un samedi
 * alors que cinq l'attendent lundi n'apprend rien de vrai.
 */
export function useProchaineJournee(childId: ID | null | undefined) {
  const data = useFamily();
  return useMemo(
    () => (data && childId ? prochaineJournee(data, childId) : null),
    [data, childId],
  );
}
