import * as actions from '@/domain/actions';
import { bandForAge, unitFor, unitOf } from '@/domain/ageBand';
import { balanceOf } from '@/domain/ledger';
import { isSupervised } from '@/domain/screens';
import { Child, FamilyData } from '@/domain/types';

import { buildDemoFamily } from '@/data/demo';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1',
  familyId: 'f1',
  firstName: 'Noah',
  age: 8,
  avatarKey: 'blue',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

function demo(): { data: FamilyData; childId: string } {
  const data = buildDemoFamily(new Date('2026-08-20T10:00:00.000Z'));
  return { data, childId: data.children[0].id };
}

describe('age register', () => {
  it('switches to the teenage register at 13', () => {
    expect(bandForAge(12)).toBe('enfant');
    expect(bandForAge(13)).toBe('ado');
    expect(unitFor('enfant')).toBe('minos');
    expect(unitFor('ado')).toBe('minutes');
  });

  it('reads the unit straight off the child', () => {
    expect(unitOf(child({ age: 7 }))).toBe('minos');
    expect(unitOf(child({ age: 15 }))).toBe('minutes');
    expect(unitOf(null)).toBe('minos');
  });
});

describe('supervised screens', () => {
  it('knows which screens Mino can drive', () => {
    expect(isSupervised('device')).toBe(false);
    expect(isSupervised('console')).toBe(true);
    expect(isSupervised('tv')).toBe(true);
    expect(isSupervised(undefined)).toBe(false);
  });

  it('starts immediately on this device', () => {
    const { data, childId } = demo();
    const out = actions.startSession(data, { childId, minutes: 20, target: 'device' });
    expect(out.session.status).toBe('running');
  });

  it('waits for a parent on a console, and bills nothing meanwhile', () => {
    const { data, childId } = demo();
    const before = balanceOf(data.transactions, childId);

    const out = actions.startSession(data, { childId, minutes: 20, target: 'console' });
    expect(out.session.status).toBe('requested');
    expect(out.session.target).toBe('console');
    expect(balanceOf(out.data.transactions, childId)).toBe(before);
  });

  it('starts the clock when the parent approves, not when the child asked', () => {
    const asked = new Date('2026-08-20T10:00:00.000Z');
    const approved = new Date('2026-08-20T10:30:00.000Z');
    const { data, childId } = demo();

    const request = actions.startSession(data, { childId, minutes: 20, target: 'console' }, asked);
    const started = actions.approveSession(request.data, { sessionId: request.session.id }, approved);

    expect(started.session.status).toBe('running');
    expect(started.session.startedAt).toBe(approved.toISOString());
    // Half an hour of waiting must not eat into the twenty minutes.
    expect(new Date(started.session.endsAt).getTime() - approved.getTime()).toBe(20 * 60_000);
  });

  it('bills only the time actually used on a supervised screen', () => {
    const asked = new Date('2026-08-20T10:00:00.000Z');
    const stopped = new Date('2026-08-20T10:12:00.000Z');
    const { data, childId } = demo();
    const before = balanceOf(data.transactions, childId);

    const request = actions.startSession(data, { childId, minutes: 20, target: 'tv' }, asked);
    const started = actions.approveSession(request.data, { sessionId: request.session.id }, asked);
    const ended = actions.endSession(
      started.data,
      { sessionId: started.session.id, status: 'stopped' },
      stopped,
    );

    expect(ended.session.consumedMinutes).toBe(12);
    expect(balanceOf(ended.data.transactions, childId)).toBe(before - 12);
  });

  it('costs nothing when the parent says no', () => {
    const { data, childId } = demo();
    const before = balanceOf(data.transactions, childId);

    const request = actions.startSession(data, { childId, minutes: 30, target: 'console' });
    const refused = actions.refuseSession(request.data, { sessionId: request.session.id });

    expect(refused.session.status).toBe('refused');
    expect(balanceOf(refused.data.transactions, childId)).toBe(before);
  });

  it('refuses a second request while one is already waiting', () => {
    const { data, childId } = demo();
    const first = actions.startSession(data, { childId, minutes: 10, target: 'console' });
    expect(() => actions.startSession(first.data, { childId, minutes: 10, target: 'tv' })).toThrow();
  });
});
