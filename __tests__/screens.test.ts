import { buildDemoFamily } from '@/data/demo';
import * as actions from '@/domain/actions';
import { bandForAge, unitFor, unitOf } from '@/domain/ageBand';
import { activeDevices, describeDevice } from '@/domain/devices';
import { balanceOf } from '@/domain/ledger';
import { Child, FamilyData } from '@/domain/types';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1',
  familyId: 'f1',
  firstName: 'Noah',
  age: 8,
  avatarKey: 'fox',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

function demo(): { data: FamilyData; childId: string; consoleId: string } {
  const data = buildDemoFamily(new Date('2026-08-20T10:00:00.000Z'));
  return { data, childId: data.children[0].id, consoleId: data.devices[0].id };
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

describe('declared devices', () => {
  it('adds and names a screen', () => {
    const { data } = demo();
    const out = actions.addDevice(data, { label: '  Xbox du salon  ', kind: 'console' });

    expect(out.device.label).toBe('Xbox du salon');
    expect(activeDevices(out.data.devices)).toHaveLength(3);
  });

  it('refuses a device with no name', () => {
    const { data } = demo();
    expect(() => actions.addDevice(data, { label: '   ', kind: 'tv' })).toThrow();
  });

  it('archives rather than deletes, so old sessions still read', () => {
    const { data, consoleId } = demo();
    const next = actions.removeDevice(data, consoleId);

    expect(activeDevices(next.devices)).toHaveLength(1);
    // The row survives, so a past session can still be named.
    expect(describeDevice(next.devices, consoleId)).toBe('Console du salon');
  });

  it('falls back gracefully for a device that no longer exists', () => {
    expect(describeDevice([], 'dev_gone')).toBe('un autre écran');
    expect(describeDevice([], undefined)).toBe('cet appareil');
  });
});

describe('sessions', () => {
  it('starts immediately on the device Mino runs on', () => {
    const { data, childId } = demo();
    const out = actions.startSession(data, { childId, minutes: 20 });
    expect(out.session.status).toBe('running');
    expect(out.session.deviceId).toBeUndefined();
  });

  it('waits for a parent on a declared screen, and bills nothing meanwhile', () => {
    const { data, childId, consoleId } = demo();
    const before = balanceOf(data.transactions, childId);

    const out = actions.startSession(data, { childId, minutes: 20, deviceId: consoleId });
    expect(out.session.status).toBe('requested');
    expect(out.session.deviceId).toBe(consoleId);
    expect(balanceOf(out.data.transactions, childId)).toBe(before);
  });

  it('waits on this device too when the family asked for approval', () => {
    const { data, childId } = demo();
    const strict = {
      ...data,
      children: data.children.map((c) => (c.id === childId ? { ...c, requireApproval: true } : c)),
    };

    expect(actions.startSession(strict, { childId, minutes: 10 }).session.status).toBe('requested');
  });

  it('starts the clock when the parent approves, not when the child asked', () => {
    const asked = new Date('2026-08-20T10:00:00.000Z');
    const approved = new Date('2026-08-20T10:30:00.000Z');
    const { data, childId, consoleId } = demo();

    const request = actions.startSession(data, { childId, minutes: 20, deviceId: consoleId }, asked);
    const started = actions.approveSession(request.data, { sessionId: request.session.id }, approved);

    expect(started.session.status).toBe('running');
    expect(started.session.startedAt).toBe(approved.toISOString());
    // Half an hour of waiting must not eat into the twenty minutes.
    expect(new Date(started.session.endsAt).getTime() - approved.getTime()).toBe(20 * 60_000);
  });

  it('bills only the time actually used on a supervised screen', () => {
    const asked = new Date('2026-08-20T10:00:00.000Z');
    const stopped = new Date('2026-08-20T10:12:00.000Z');
    const { data, childId, consoleId } = demo();
    const before = balanceOf(data.transactions, childId);

    const request = actions.startSession(data, { childId, minutes: 20, deviceId: consoleId }, asked);
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
    const { data, childId, consoleId } = demo();
    const before = balanceOf(data.transactions, childId);

    const request = actions.startSession(data, { childId, minutes: 30, deviceId: consoleId });
    const refused = actions.refuseSession(request.data, { sessionId: request.session.id });

    expect(refused.session.status).toBe('refused');
    expect(balanceOf(refused.data.transactions, childId)).toBe(before);
  });

  it('refuses a second request while one is already waiting', () => {
    const { data, childId, consoleId } = demo();
    const first = actions.startSession(data, { childId, minutes: 10, deviceId: consoleId });
    expect(() => actions.startSession(first.data, { childId, minutes: 10 })).toThrow();
  });
});
