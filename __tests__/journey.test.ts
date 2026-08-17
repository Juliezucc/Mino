import { pendingCompletions, uncelebratedCompletions } from '@/domain/ledger';
import { missionsForChild } from '@/domain/missions';
import { useMinoStore } from '@/store/useMinoStore';

/**
 * The reference scenario, end to end, through the real store:
 *
 *   Julie creates "Ranger ta chambre +15" for Noah
 *     → Noah sees the mission
 *     → Noah taps "J'ai terminé"
 *     → Julie sees the request
 *     → Julie taps "Valider +15 min"
 *     → Noah gets a celebration and his counter goes from 35 to 50.
 */
describe('mission → validation → minutes', () => {
  const store = () => useMinoStore.getState();

  beforeEach(async () => {
    await store().startDemo();
  });

  it('takes Noah from 35 to 50 minutes', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const balance = () => {
      const data = useMinoStore.getState().data!;
      return data.transactions.reduce((sum, tx) => (tx.childId === noah.id ? sum + tx.delta : sum), 0);
    };

    // Demo starts exactly where the brief says.
    expect(balance()).toBe(35);

    // 1. Julie creates the mission.
    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });

    // 2. Noah sees it, still to do.
    const visible = missionsForChild(useMinoStore.getState().data!, noah.id);
    const mine = visible.find((m) => m.mission.id === missionId);
    expect(mine).toBeDefined();
    expect(mine!.state).toBe('todo');

    // 3. Noah taps "J'ai terminé" — no minutes yet, just a request.
    const completionId = await store().completeMission(noah.id, missionId);
    expect(balance()).toBe(35);
    expect(
      missionsForChild(useMinoStore.getState().data!, noah.id).find(
        (m) => m.mission.id === missionId,
      )!.state,
    ).toBe('pending');

    // 4. Julie sees the request.
    const requests = pendingCompletions(useMinoStore.getState().data!);
    expect(requests.some((r) => r.id === completionId)).toBe(true);

    // 5. Julie validates: minutes land immediately, as one ledger entry.
    await store().approveCompletion(completionId);
    expect(balance()).toBe(50);

    const data = useMinoStore.getState().data!;
    const tx = data.transactions.filter((t) => t.refId === completionId);
    expect(tx).toHaveLength(1);
    expect(tx[0].delta).toBe(15);
    expect(tx[0].kind).toBe('mission_reward');
    expect(tx[0].reason).toBe('Ranger ta chambre');

    // 6. Noah owes himself a celebration, once.
    const toCelebrate = uncelebratedCompletions(data, noah.id);
    expect(toCelebrate.map((c) => c.id)).toEqual([completionId]);

    await store().markCelebrated(completionId);
    expect(uncelebratedCompletions(useMinoStore.getState().data!, noah.id)).toHaveLength(0);

    // The mission now reads as done for the day.
    expect(
      missionsForChild(useMinoStore.getState().data!, noah.id).find(
        (m) => m.mission.id === missionId,
      )!.state,
    ).toBe('done');
  });

  it('adds no minutes when the parent refuses', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });

    const completionId = await store().completeMission(noah.id, missionId);
    await store().rejectCompletion(completionId);

    const data = useMinoStore.getState().data!;
    expect(data.transactions.filter((t) => t.refId === completionId)).toHaveLength(0);
    expect(
      data.transactions.reduce((s, t) => (t.childId === noah.id ? s + t.delta : s), 0),
    ).toBe(35);

    // A refused mission goes back to the to-do list — the child can try again.
    expect(
      missionsForChild(data, noah.id).find((m) => m.mission.id === missionId)!.state,
    ).toBe('todo');
  });

  it('refuses to validate the same request twice', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });
    const completionId = await store().completeMission(noah.id, missionId);

    await store().approveCompletion(completionId);
    await expect(store().approveCompletion(completionId)).rejects.toThrow();

    const data = useMinoStore.getState().data!;
    expect(data.transactions.filter((t) => t.refId === completionId)).toHaveLength(1);
    expect(
      data.transactions.reduce((s, t) => (t.childId === noah.id ? s + t.delta : s), 0),
    ).toBe(50);
  });

  it('does not let a child send the same mission twice while it waits', async () => {
    const noah = store().data!.children.find((c) => c.firstName === 'Noah')!;
    const missionId = await store().addMission({
      title: 'Ranger ta chambre',
      icon: '🧸',
      minutes: 15,
      repeat: { kind: 'daily' },
      childIds: [noah.id],
    });

    await store().completeMission(noah.id, missionId);
    await expect(store().completeMission(noah.id, missionId)).rejects.toThrow();
  });

  it('keeps the demo waiting request visible to the parent', async () => {
    const data = useMinoStore.getState().data!;
    const requests = pendingCompletions(data);
    expect(requests).toHaveLength(1);

    const elliott = data.children.find((c) => c.firstName === 'Elliott')!;
    expect(requests[0].childId).toBe(elliott.id);

    await store().approveCompletion(requests[0].id);
    const after = useMinoStore.getState().data!;
    expect(after.transactions.reduce((s, t) => (t.childId === elliott.id ? s + t.delta : s), 0)).toBe(
      30,
    );
  });
});
