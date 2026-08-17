import { buildDemoFamily } from '@/data/demo';
import { adjustBalance, endSession, startSession } from '@/domain/actions';
import { balanceOf } from '@/domain/ledger';
import { LocalTimerScreenTimeService } from '@/services/screenTime';

describe('using screen time', () => {
  it('bills only the minutes actually spent', () => {
    const start = new Date('2026-08-17T15:00:00Z');
    const data = buildDemoFamily(start);
    const noah = data.children[0];

    const started = startSession(data, { childId: noah.id, minutes: 20 }, start);
    // Nothing is charged upfront — the child still owns their 35 minutes.
    expect(balanceOf(started.data.transactions, noah.id)).toBe(35);

    const twelveMinutesLater = new Date(start.getTime() + 12 * 60_000);
    const ended = endSession(
      started.data,
      { sessionId: started.session.id, status: 'stopped' },
      twelveMinutesLater,
    );

    expect(ended.transaction?.delta).toBe(-12);
    expect(ended.transaction?.kind).toBe('screen_time_used');
    expect(balanceOf(ended.data.transactions, noah.id)).toBe(23);
    expect(ended.session.status).toBe('stopped');
  });

  it('never charges more than the session that was granted', () => {
    const start = new Date('2026-08-17T15:00:00Z');
    const data = buildDemoFamily(start);
    const noah = data.children[0];

    const started = startSession(data, { childId: noah.id, minutes: 10 }, start);
    const muchLater = new Date(start.getTime() + 90 * 60_000);
    const ended = endSession(started.data, { sessionId: started.session.id }, muchLater);

    expect(ended.transaction?.delta).toBe(-10);
    expect(balanceOf(ended.data.transactions, noah.id)).toBe(25);
  });

  it('refuses to start a session the child cannot afford', () => {
    const data = buildDemoFamily();
    const elliott = data.children[1];

    expect(() => startSession(data, { childId: elliott.id, minutes: 30 })).toThrow();
    expect(() => startSession(data, { childId: elliott.id, minutes: 0 })).toThrow();
  });

  it('refuses two sessions at once for the same child', () => {
    const data = buildDemoFamily();
    const noah = data.children[0];
    const started = startSession(data, { childId: noah.id, minutes: 10 });

    expect(() => startSession(started.data, { childId: noah.id, minutes: 10 })).toThrow();
  });

  it('records parent adjustments as ledger entries', () => {
    const data = buildDemoFamily();
    const noah = data.children[0];

    const bonus = adjustBalance(data, { childId: noah.id, delta: 15, reason: 'Bonus parent' });
    expect(balanceOf(bonus.transactions, noah.id)).toBe(50);

    const penalty = adjustBalance(bonus, { childId: noah.id, delta: -5, reason: 'Retrait parent' });
    expect(balanceOf(penalty.transactions, noah.id)).toBe(45);
    expect(penalty.transactions.at(-1)?.kind).toBe('parent_adjustment');
  });
});

describe('ScreenTimeService seam', () => {
  it('is honest about what the MVP can do', async () => {
    const service = new LocalTimerScreenTimeService();
    expect(service.capability).toBe('timer-only');
    expect(await service.isAuthorized()).toBe(true);
  });

  it('tracks a grant until it is revoked', async () => {
    const service = new LocalTimerScreenTimeService();
    await service.grant({ sessionId: 'ses_1', childId: 'child_1', minutes: 20 });

    const status = await service.status('child_1');
    expect(status.active).toBe(true);
    expect(status.remainingSeconds).toBeGreaterThan(1190);

    await service.revoke('ses_1');
    expect((await service.status('child_1')).active).toBe(false);
  });
});
