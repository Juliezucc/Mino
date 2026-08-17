import { buildDemoFamily } from '@/data/demo';
import { approveCompletion, completeMission, createMission } from '@/domain/actions';
import { describeRepeat, isScheduledOn, missionsForChild } from '@/domain/missions';

describe('mission scheduling', () => {
  it('only shows "certains jours" missions on the selected days', () => {
    // 2026-08-17 is a Monday, 2026-08-18 a Tuesday.
    const monday = new Date('2026-08-17T10:00:00Z');
    const tuesday = new Date('2026-08-18T10:00:00Z');

    expect(isScheduledOn({ kind: 'weekdays', days: [1] }, monday)).toBe(true);
    expect(isScheduledOn({ kind: 'weekdays', days: [1] }, tuesday)).toBe(false);
    expect(isScheduledOn({ kind: 'daily' }, tuesday)).toBe(true);
    expect(isScheduledOn({ kind: 'never' }, tuesday)).toBe(true);
  });

  it('resets a daily mission the next day but keeps a one-shot done', () => {
    const day1 = new Date('2026-08-17T09:00:00Z');
    const day2 = new Date('2026-08-18T09:00:00Z');

    let data = buildDemoFamily(day1);
    const child = data.children[0];
    const parent = data.parents[0];

    const daily = createMission(
      data,
      { title: 'Vider le lave-vaisselle', icon: '🍽️', minutes: 10, repeat: { kind: 'daily' }, childIds: [child.id], createdBy: parent.id },
      day1,
    );
    data = daily.data;

    const once = createMission(
      data,
      { title: 'Trier mes jouets', icon: '🧸', minutes: 20, repeat: { kind: 'never' }, childIds: [child.id], createdBy: parent.id },
      day1,
    );
    data = once.data;

    for (const missionId of [daily.mission.id, once.mission.id]) {
      const completed = completeMission(data, { childId: child.id, missionId }, day1);
      data = approveCompletion(
        completed.data,
        { completionId: completed.completion.id, parentId: parent.id },
        day1,
      ).data;
    }

    const sameDay = missionsForChild(data, child.id, day1);
    expect(sameDay.find((m) => m.mission.id === daily.mission.id)!.state).toBe('done');
    expect(sameDay.find((m) => m.mission.id === once.mission.id)!.state).toBe('done');

    const nextDay = missionsForChild(data, child.id, day2);
    expect(nextDay.find((m) => m.mission.id === daily.mission.id)!.state).toBe('todo');
    expect(nextDay.find((m) => m.mission.id === once.mission.id)!.state).toBe('done');
  });

  it('shows missions still to do before the others', () => {
    const data = buildDemoFamily();
    const noah = data.children[0];
    const states = missionsForChild(data, noah.id).map((m) => m.state);
    const rank = { todo: 0, pending: 1, done: 2 } as const;

    for (let i = 1; i < states.length; i += 1) {
      expect(rank[states[i - 1]] <= rank[states[i]]).toBe(true);
    }
  });

  it('only assigns a mission to the chosen children', () => {
    const data = buildDemoFamily();
    const [noah, elliott] = data.children;

    const created = createMission(data, {
      title: 'Sortir le chien',
      icon: '🐶',
      minutes: 10,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
      createdBy: data.parents[0].id,
    });

    expect(missionsForChild(created.data, noah.id).some((m) => m.mission.id === created.mission.id)).toBe(true);
    expect(missionsForChild(created.data, elliott.id).some((m) => m.mission.id === created.mission.id)).toBe(false);
  });

  it('rejects missions a child could not understand or that reward nothing', () => {
    const data = buildDemoFamily();
    const base = {
      icon: '⭐',
      repeat: { kind: 'daily' as const },
      childIds: [data.children[0].id],
      createdBy: data.parents[0].id,
    };

    expect(() => createMission(data, { ...base, title: '   ', minutes: 10 })).toThrow();
    expect(() => createMission(data, { ...base, title: 'Test', minutes: 0 })).toThrow();
    expect(() => createMission(data, { ...base, title: 'Test', minutes: 10, childIds: [] })).toThrow();
  });

  it('describes repeat rules in plain French', () => {
    expect(describeRepeat({ kind: 'daily' })).toBe('Tous les jours');
    expect(describeRepeat({ kind: 'never' })).toBe('Une seule fois');
    expect(describeRepeat({ kind: 'weekdays', days: [1, 3] })).toBe('Lun · Mer');
  });
});
