import { createId } from './id';
import { balanceOf } from './ledger';
import {
  AvatarKey,
  Child,
  FamilyData,
  ID,
  Mission,
  MissionAssignment,
  MissionCompletion,
  RepeatRule,
  ScreenTimeSession,
  ScreenTimeTransaction,
} from './types';

/**
 * Every state change lives here as a pure function: (data, input) -> new data.
 * The store and the repositories only persist the result, which keeps the whole
 * product logic testable without React, navigation or a network.
 */

export class DomainError extends Error {}

function iso(now: Date) {
  return now.toISOString();
}

/* ------------------------------------------------------------------ children */

export interface CreateChildInput {
  firstName: string;
  age: number;
  avatarKey: AvatarKey;
  pin?: string;
  startingMinutes?: number;
}

export function createChild(
  data: FamilyData,
  input: CreateChildInput,
  now: Date = new Date(),
): { data: FamilyData; child: Child } {
  const child: Child = {
    id: createId('child'),
    familyId: data.family.id,
    firstName: input.firstName.trim(),
    age: input.age,
    avatarKey: input.avatarKey,
    pin: input.pin,
    createdAt: iso(now),
  };

  const transactions = [...data.transactions];
  if (input.startingMinutes && input.startingMinutes > 0) {
    transactions.push({
      id: createId('tx'),
      familyId: data.family.id,
      childId: child.id,
      delta: input.startingMinutes,
      kind: 'initial_balance',
      reason: 'Solde de départ',
      createdAt: iso(now),
    });
  }

  return { data: { ...data, children: [...data.children, child], transactions }, child };
}

export function updateChild(data: FamilyData, childId: ID, patch: Partial<Child>): FamilyData {
  return {
    ...data,
    children: data.children.map((c) => (c.id === childId ? { ...c, ...patch, id: c.id } : c)),
  };
}

export function removeChild(data: FamilyData, childId: ID): FamilyData {
  return {
    ...data,
    children: data.children.filter((c) => c.id !== childId),
    assignments: data.assignments.filter((a) => a.childId !== childId),
    completions: data.completions.filter((c) => c.childId !== childId),
    transactions: data.transactions.filter((t) => t.childId !== childId),
    sessions: data.sessions.filter((s) => s.childId !== childId),
  };
}

/* ------------------------------------------------------------------ missions */

export interface CreateMissionInput {
  title: string;
  icon: string;
  minutes: number;
  repeat: RepeatRule;
  childIds: ID[];
  createdBy: ID;
}

export function createMission(
  data: FamilyData,
  input: CreateMissionInput,
  now: Date = new Date(),
): { data: FamilyData; mission: Mission } {
  if (!input.title.trim()) throw new DomainError('Le nom de la mission est obligatoire.');
  if (input.minutes <= 0) throw new DomainError('Le temps gagné doit être supérieur à 0.');
  if (input.childIds.length === 0) throw new DomainError('Choisis au moins un enfant.');

  const mission: Mission = {
    id: createId('mission'),
    familyId: data.family.id,
    title: input.title.trim(),
    icon: input.icon,
    minutes: input.minutes,
    repeat: input.repeat,
    createdBy: input.createdBy,
    archived: false,
    createdAt: iso(now),
  };

  const assignments: MissionAssignment[] = input.childIds.map((childId) => ({
    id: createId('asg'),
    missionId: mission.id,
    childId,
    active: true,
    createdAt: iso(now),
  }));

  return {
    data: {
      ...data,
      missions: [...data.missions, mission],
      assignments: [...data.assignments, ...assignments],
    },
    mission,
  };
}

export function archiveMission(data: FamilyData, missionId: ID): FamilyData {
  return {
    ...data,
    missions: data.missions.map((m) => (m.id === missionId ? { ...m, archived: true } : m)),
    assignments: data.assignments.map((a) =>
      a.missionId === missionId ? { ...a, active: false } : a,
    ),
  };
}

/* --------------------------------------------------------------- completions */

/** Child taps "J'AI TERMINÉ" → the mission waits for the parent. No minutes yet. */
export function completeMission(
  data: FamilyData,
  params: { childId: ID; missionId: ID },
  now: Date = new Date(),
): { data: FamilyData; completion: MissionCompletion } {
  const mission = data.missions.find((m) => m.id === params.missionId);
  if (!mission) throw new DomainError('Mission introuvable.');

  const assignment = data.assignments.find(
    (a) => a.missionId === params.missionId && a.childId === params.childId && a.active,
  );
  if (!assignment) throw new DomainError("Cette mission n'est pas assignée à cet enfant.");

  const alreadyPending = data.completions.some(
    (c) => c.missionId === mission.id && c.childId === params.childId && c.status === 'pending',
  );
  if (alreadyPending) throw new DomainError('Cette mission attend déjà une validation.');

  const completion: MissionCompletion = {
    id: createId('cmp'),
    familyId: data.family.id,
    assignmentId: assignment.id,
    missionId: mission.id,
    childId: params.childId,
    status: 'pending',
    minutesRequested: mission.minutes,
    minutesAwarded: 0,
    completedAt: iso(now),
  };

  return { data: { ...data, completions: [...data.completions, completion] }, completion };
}

/**
 * Parent taps "VALIDER +15 MIN" → the completion is approved AND a ledger entry
 * is written in the same operation. There is no path that credits minutes
 * without a transaction.
 */
export function approveCompletion(
  data: FamilyData,
  params: { completionId: ID; parentId: ID; minutes?: number },
  now: Date = new Date(),
): { data: FamilyData; completion: MissionCompletion; transaction: ScreenTimeTransaction } {
  const completion = data.completions.find((c) => c.id === params.completionId);
  if (!completion) throw new DomainError('Demande introuvable.');
  if (completion.status !== 'pending') throw new DomainError('Cette demande est déjà traitée.');

  const mission = data.missions.find((m) => m.id === completion.missionId);
  const minutes = params.minutes ?? completion.minutesRequested;

  const approved: MissionCompletion = {
    ...completion,
    status: 'approved',
    minutesAwarded: minutes,
    reviewedAt: iso(now),
    reviewedBy: params.parentId,
  };

  const transaction: ScreenTimeTransaction = {
    id: createId('tx'),
    familyId: data.family.id,
    childId: completion.childId,
    delta: minutes,
    kind: 'mission_reward',
    reason: mission?.title ?? 'Mission validée',
    refId: completion.id,
    createdAt: iso(now),
  };

  return {
    data: {
      ...data,
      completions: data.completions.map((c) => (c.id === approved.id ? approved : c)),
      transactions: [...data.transactions, transaction],
    },
    completion: approved,
    transaction,
  };
}

export function rejectCompletion(
  data: FamilyData,
  params: { completionId: ID; parentId: ID },
  now: Date = new Date(),
): { data: FamilyData; completion: MissionCompletion } {
  const completion = data.completions.find((c) => c.id === params.completionId);
  if (!completion) throw new DomainError('Demande introuvable.');
  if (completion.status !== 'pending') throw new DomainError('Cette demande est déjà traitée.');

  const rejected: MissionCompletion = {
    ...completion,
    status: 'rejected',
    minutesAwarded: 0,
    reviewedAt: iso(now),
    reviewedBy: params.parentId,
  };

  return {
    data: {
      ...data,
      completions: data.completions.map((c) => (c.id === rejected.id ? rejected : c)),
    },
    completion: rejected,
  };
}

/** The child has seen the confetti — don't show it twice. */
export function markCelebrated(
  data: FamilyData,
  completionId: ID,
  now: Date = new Date(),
): FamilyData {
  return {
    ...data,
    completions: data.completions.map((c) =>
      c.id === completionId ? { ...c, celebratedAt: iso(now) } : c,
    ),
  };
}

/* ------------------------------------------------------------------ sessions */

export function startSession(
  data: FamilyData,
  params: { childId: ID; minutes: number },
  now: Date = new Date(),
): { data: FamilyData; session: ScreenTimeSession } {
  const available = balanceOf(data.transactions, params.childId);
  if (params.minutes <= 0) throw new DomainError('Choisis une durée.');
  if (params.minutes > available) throw new DomainError("Tu n'as pas assez de minutes.");

  const running = data.sessions.find(
    (s) => s.childId === params.childId && s.status === 'running',
  );
  if (running) throw new DomainError('Une session est déjà en cours.');

  const session: ScreenTimeSession = {
    id: createId('ses'),
    familyId: data.family.id,
    childId: params.childId,
    requestedMinutes: params.minutes,
    startedAt: iso(now),
    endsAt: new Date(now.getTime() + params.minutes * 60_000).toISOString(),
    status: 'running',
  };

  return { data: { ...data, sessions: [...data.sessions, session] }, session };
}

/**
 * Ends a session and bills the minutes actually consumed. Stopping early only
 * costs the elapsed time, which keeps the deal fair from a child's point of view.
 */
export function endSession(
  data: FamilyData,
  params: { sessionId: ID; status?: 'finished' | 'stopped' },
  now: Date = new Date(),
): { data: FamilyData; session: ScreenTimeSession; transaction?: ScreenTimeTransaction } {
  const session = data.sessions.find((s) => s.id === params.sessionId);
  if (!session) throw new DomainError('Session introuvable.');
  if (session.status !== 'running') return { data, session };

  const elapsedMs = Math.max(0, now.getTime() - new Date(session.startedAt).getTime());
  const elapsedMinutes = Math.min(session.requestedMinutes, Math.round(elapsedMs / 60_000));

  const ended: ScreenTimeSession = {
    ...session,
    status: params.status ?? 'finished',
    endedAt: iso(now),
    consumedMinutes: elapsedMinutes,
  };

  const sessions = data.sessions.map((s) => (s.id === ended.id ? ended : s));
  if (elapsedMinutes <= 0) {
    return { data: { ...data, sessions }, session: ended };
  }

  const transaction: ScreenTimeTransaction = {
    id: createId('tx'),
    familyId: data.family.id,
    childId: session.childId,
    delta: -elapsedMinutes,
    kind: 'screen_time_used',
    reason: 'Temps d’écran utilisé',
    refId: session.id,
    createdAt: iso(now),
  };

  return {
    data: { ...data, sessions, transactions: [...data.transactions, transaction] },
    session: ended,
    transaction,
  };
}

/** Manual correction by a parent (bonus or penalty) — still a ledger entry. */
export function adjustBalance(
  data: FamilyData,
  params: { childId: ID; delta: number; reason: string },
  now: Date = new Date(),
): FamilyData {
  if (params.delta === 0) return data;
  const transaction: ScreenTimeTransaction = {
    id: createId('tx'),
    familyId: data.family.id,
    childId: params.childId,
    delta: params.delta,
    kind: 'parent_adjustment',
    reason: params.reason,
    createdAt: iso(now),
  };
  return { ...data, transactions: [...data.transactions, transaction] };
}
