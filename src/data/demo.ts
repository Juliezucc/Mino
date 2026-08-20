import { createFamilyCode, createId, createReferralCode } from '@/domain/id';
import {
  Child,
  FamilyData,
  Mission,
  MissionAssignment,
  MissionCompletion,
  Parent,
  ScreenTimeTransaction,
} from '@/domain/types';

export const DEMO_PARENT_PIN = '1234';

function at(now: Date, hours: number, minutes = 0): string {
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  // Never place demo history in the future — it would look broken in the evening.
  return (d > now ? now : d).toISOString();
}

/**
 * Demo family, ready to test the core journey in one tap.
 *
 * Noah starts at exactly 35 minutes with "Ranger ma chambre (+15)" still to do,
 * so the reference scenario 35 → 50 works straight out of the box.
 */
export function buildDemoFamily(now: Date = new Date()): FamilyData {
  const family = {
    id: createId('fam'),
    name: 'Famille Martin',
    code: createFamilyCode(),
    referralCode: createReferralCode(),
    createdAt: at(now, 8),
  };

  const julie: Parent = {
    id: createId('parent'),
    familyId: family.id,
    displayName: 'Julie',
    email: 'julie@mino.app',
    createdAt: at(now, 8),
  };

  const noah: Child = {
    id: createId('child'),
    familyId: family.id,
    firstName: 'Noah',
    age: 8,
    avatarKey: 'blue',
    createdAt: at(now, 8),
  };

  const elliott: Child = {
    id: createId('child'),
    familyId: family.id,
    firstName: 'Elliott',
    age: 6,
    avatarKey: 'green',
    createdAt: at(now, 8),
  };

  // A teenager, so the second register is visible the moment the demo opens:
  // minutes instead of minos, sober wording, no confetti.
  const lea: Child = {
    id: createId('child'),
    familyId: family.id,
    firstName: 'Léa',
    age: 14,
    avatarKey: 'purple',
    createdAt: at(now, 8),
  };

  const mission = (
    title: string,
    icon: string,
    minutes: number,
    childIds: string[],
  ): { mission: Mission; assignments: MissionAssignment[] } => {
    const m: Mission = {
      id: createId('mission'),
      familyId: family.id,
      title,
      icon,
      minutes,
      repeat: { kind: 'daily' },
      createdBy: julie.id,
      archived: false,
      createdAt: at(now, 8),
    };
    return {
      mission: m,
      assignments: childIds.map((childId) => ({
        id: createId('asg'),
        missionId: m.id,
        childId,
        active: true,
        createdAt: at(now, 8),
      })),
    };
  };

  const bed = mission('Faire mon lit', '🛏️', 5, [noah.id, elliott.id]);
  const room = mission('Ranger ma chambre', '🧸', 15, [noah.id]);
  const table = mission('Débarrasser la table', '🍽️', 10, [noah.id]);
  const teeth = mission('Me brosser les dents', '🪥', 5, [noah.id, elliott.id]);
  const bag = mission('Préparer mon cartable', '🎒', 10, [elliott.id]);
  const homework = mission('Faire mes devoirs sans qu’on me le demande', '📝', 25, [lea.id]);
  const laundry = mission('Lancer et étendre une lessive', '🧺', 20, [lea.id]);
  const offline = mission('Une heure sans téléphone', '🌙', 20, [lea.id]);

  const missions = [bed, room, table, teeth, bag, homework, laundry, offline];

  const completions: MissionCompletion[] = [];
  const transactions: ScreenTimeTransaction[] = [];

  /** Approved earlier today: the mission is done AND the ledger holds the minutes. */
  const approved = (
    def: { mission: Mission; assignments: MissionAssignment[] },
    childId: string,
    hour: number,
    minute = 0,
  ) => {
    const assignment = def.assignments.find((a) => a.childId === childId)!;
    const when = at(now, hour, minute);
    const completion: MissionCompletion = {
      id: createId('cmp'),
      familyId: family.id,
      assignmentId: assignment.id,
      missionId: def.mission.id,
      childId,
      status: 'approved',
      minutesRequested: def.mission.minutes,
      minutesAwarded: def.mission.minutes,
      completedAt: when,
      reviewedAt: when,
      reviewedBy: julie.id,
      celebratedAt: when,
    };
    completions.push(completion);
    transactions.push({
      id: createId('tx'),
      familyId: family.id,
      childId,
      delta: def.mission.minutes,
      kind: 'mission_reward',
      reason: def.mission.title,
      refId: completion.id,
      createdAt: when,
    });
  };

  // Noah: 5 + 10 + 5 = 20 minutes earned this morning…
  approved(bed, noah.id, 8, 15);
  approved(table, noah.id, 8, 40);
  approved(teeth, noah.id, 9, 5);

  // …plus a welcome bonus, for a round 35 minutes available.
  transactions.push({
    id: createId('tx'),
    familyId: family.id,
    childId: noah.id,
    delta: 15,
    kind: 'initial_balance',
    reason: 'Bienvenue sur Mino',
    createdAt: at(now, 8, 5),
  });

  // Elliott: 5 earned + 15 bonus = 20 minutes available.
  approved(bed, elliott.id, 8, 20);
  transactions.push({
    id: createId('tx'),
    familyId: family.id,
    childId: elliott.id,
    delta: 15,
    kind: 'initial_balance',
    reason: 'Bienvenue sur Mino',
    createdAt: at(now, 8, 5),
  });

  // Léa: 25 earned + 30 initial = 55 minutes available.
  approved(homework, lea.id, 8, 30);
  transactions.push({
    id: createId('tx'),
    familyId: family.id,
    childId: lea.id,
    delta: 30,
    kind: 'initial_balance',
    reason: 'Bienvenue sur Mino',
    createdAt: at(now, 8, 5),
  });

  // One request already waiting, so the parent side is never empty on first launch.
  const bagAssignment = bag.assignments[0];
  completions.push({
    id: createId('cmp'),
    familyId: family.id,
    assignmentId: bagAssignment.id,
    missionId: bag.mission.id,
    childId: elliott.id,
    status: 'pending',
    minutesRequested: bag.mission.minutes,
    minutesAwarded: 0,
    completedAt: at(now, 9, 30),
  });

  return {
    family,
    parents: [julie],
    children: [noah, elliott, lea],
    missions: missions.map((m) => m.mission),
    assignments: missions.flatMap((m) => m.assignments),
    completions,
    transactions,
    sessions: [],
    // Declared up front so the console flow is testable straight from the demo.
    devices: [
      {
        id: createId('dev'),
        familyId: family.id,
        label: 'Nintendo Switch',
        kind: 'console',
        createdAt: at(now, 8),
      },
      {
        id: createId('dev'),
        familyId: family.id,
        label: 'Télé du salon',
        kind: 'tv',
        createdAt: at(now, 8),
      },
    ],
  };
}

/** Empty family used by the real onboarding flow. */
export function buildEmptyFamily(
  input: { familyName: string; parentName: string; email: string },
  now: Date = new Date(),
): FamilyData {
  const family = {
    id: createId('fam'),
    name: input.familyName,
    code: createFamilyCode(),
    referralCode: createReferralCode(),
    createdAt: now.toISOString(),
  };
  const parent: Parent = {
    id: createId('parent'),
    familyId: family.id,
    displayName: input.parentName,
    email: input.email,
    createdAt: now.toISOString(),
  };
  return {
    family,
    parents: [parent],
    children: [],
    missions: [],
    assignments: [],
    completions: [],
    transactions: [],
    sessions: [],
    devices: [],
  };
}
