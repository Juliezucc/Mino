import { isSameDay } from './ledger';
import {
  FamilyData,
  ID,
  Mission,
  MissionAssignment,
  MissionCompletion,
  RepeatRule,
  Weekday,
} from './types';

export type MissionState = 'todo' | 'pending' | 'done';

export interface ChildMission {
  mission: Mission;
  assignment: MissionAssignment;
  state: MissionState;
  /** The completion driving `pending` / `done`, when there is one. */
  completion?: MissionCompletion;
}

/** Is the mission scheduled for that day? A one-shot mission is always schedulable. */
export function isScheduledOn(repeat: RepeatRule, date: Date): boolean {
  switch (repeat.kind) {
    case 'never':
      return true;
    case 'daily':
      return true;
    case 'weekdays':
      return (repeat.days ?? []).includes(date.getDay() as Weekday);
    default:
      return true;
  }
}

/**
 * A repeating mission resets every day; a one-shot mission stays done forever.
 * That is the only scheduling rule the MVP needs.
 */
function completionCountsForToday(
  completion: MissionCompletion,
  repeat: RepeatRule,
  now: Date,
): boolean {
  if (repeat.kind === 'never') return true;
  return isSameDay(completion.completedAt, now);
}

export function missionsForChild(
  data: FamilyData,
  childId: ID,
  now: Date = new Date(),
): ChildMission[] {
  const result: ChildMission[] = [];

  for (const assignment of data.assignments) {
    if (assignment.childId !== childId || !assignment.active) continue;

    const mission = data.missions.find((m) => m.id === assignment.missionId);
    if (!mission || mission.archived) continue;
    if (!isScheduledOn(mission.repeat, now)) continue;

    const relevant = data.completions
      .filter(
        (c) =>
          c.childId === childId &&
          c.missionId === mission.id &&
          c.status !== 'rejected' &&
          completionCountsForToday(c, mission.repeat, now),
      )
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));

    const latest = relevant[0];
    const state: MissionState = !latest ? 'todo' : latest.status === 'pending' ? 'pending' : 'done';

    result.push({ mission, assignment, state, completion: latest });
  }

  // Missions still to do first — that is what a child needs to see.
  const order: Record<MissionState, number> = { todo: 0, pending: 1, done: 2 };
  return result.sort(
    (a, b) => order[a.state] - order[b.state] || a.mission.createdAt.localeCompare(b.mission.createdAt),
  );
}

export function missionById(data: FamilyData, missionId: ID): Mission | undefined {
  return data.missions.find((m) => m.id === missionId);
}

export function childrenOfMission(data: FamilyData, missionId: ID): ID[] {
  return data.assignments
    .filter((a) => a.missionId === missionId && a.active)
    .map((a) => a.childId);
}

export function describeRepeat(repeat: RepeatRule): string {
  const labels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  switch (repeat.kind) {
    case 'daily':
      return 'Tous les jours';
    case 'weekdays': {
      const days = (repeat.days ?? []).slice().sort();
      if (days.length === 0) return 'Certains jours';
      return days.map((d) => labels[d]).join(' · ');
    }
    default:
      return 'Une seule fois';
  }
}
