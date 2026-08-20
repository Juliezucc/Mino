import {
  DEFAULT_PREFERENCES,
  bonusGranted,
  completionApproved,
  completionRejected,
  isQuietHour,
  missionCompleted,
  sessionEndingSoon,
  sessionRequested,
  shouldDeliver,
} from '@/domain/notifications';
import { Child, Device, Mission } from '@/domain/types';

const child = (over: Partial<Child> = {}): Child => ({
  id: 'c1',
  familyId: 'f1',
  firstName: 'Noah',
  age: 8,
  avatarKey: 'fox',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const mission: Mission = {
  id: 'm1',
  familyId: 'f1',
  title: 'Ranger ma chambre',
  icon: '🧸',
  minutes: 15,
  repeat: { kind: 'daily' },
  createdBy: 'p1',
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const devices: Device[] = [
  { id: 'd1', familyId: 'f1', label: 'Nintendo Switch', kind: 'console', createdAt: '2026-01-01' },
];

const at = (hour: number) => new Date(`2026-08-20T${String(hour).padStart(2, '0')}:30:00`);

describe('who hears what', () => {
  it('tells the parents when a mission is waiting on them', () => {
    const payload = missionCompleted(child(), mission);
    expect(payload.audience).toBe('parents');
    expect(payload.body).toContain('Ranger ma chambre');
  });

  it('tells the child when the minutes have landed, in their own words', () => {
    expect(completionApproved(child({ age: 8 }), 15).body).toBe('Tu as gagné 15 minos.');
    expect(completionApproved(child({ age: 15 }), 15).body).toBe('Tu as gagné 15 min.');
  });

  it('says a refused mission came back, and blames nobody', () => {
    const payload = completionRejected(child(), mission);
    expect(payload.title).toBe('Mission à refaire');
    expect(payload.body).not.toMatch(/pas fait|raté|non/i);
  });

  it('names the screen a request is for', () => {
    expect(sessionRequested(child(), 20, devices, 'd1').body).toBe('20 min sur Nintendo Switch');
  });

  it('carries the reason on a bonus, since that is what gives it value', () => {
    expect(bonusGranted(child(), 15, 'Belle journée').body).toBe('Belle journée');
  });
});

describe('quiet hours', () => {
  it('covers the evening and the night', () => {
    expect(isQuietHour(at(19))).toBe(false);
    expect(isQuietHour(at(20))).toBe(true);
    expect(isQuietHour(at(23))).toBe(true);
    expect(isQuietHour(at(6))).toBe(true);
    expect(isQuietHour(at(7))).toBe(false);
  });

  it('holds a validation until the morning', () => {
    const payload = completionApproved(child(), 15);
    expect(shouldDeliver(payload, DEFAULT_PREFERENCES, at(21))).toBe(false);
    expect(shouldDeliver(payload, DEFAULT_PREFERENCES, at(18))).toBe(true);
  });

  it('lets the five-minute warning through anyway', () => {
    // A screen going dark with no warning is worse than one buzz at 20h30.
    const payload = sessionEndingSoon(child(), new Date(Date.now() + 20 * 60_000).toISOString())!;
    expect(shouldDeliver(payload, DEFAULT_PREFERENCES, at(21))).toBe(true);
  });

  it('can be turned off deliberately', () => {
    const payload = completionApproved(child(), 15);
    expect(shouldDeliver(payload, { ...DEFAULT_PREFERENCES, quietHours: false }, at(21))).toBe(true);
  });
});

describe('preferences', () => {
  it('mutes one side without muting the other', () => {
    const forParents = missionCompleted(child(), mission);
    const forChild = completionApproved(child(), 15);
    const parentsOff = { ...DEFAULT_PREFERENCES, parents: false };

    expect(shouldDeliver(forParents, parentsOff, at(12))).toBe(false);
    expect(shouldDeliver(forChild, parentsOff, at(12))).toBe(true);
  });
});

describe('the five-minute warning', () => {
  it('is scheduled five minutes before the end', () => {
    const now = new Date('2026-08-20T14:00:00.000Z');
    const endsAt = new Date('2026-08-20T14:20:00.000Z').toISOString();

    expect(sessionEndingSoon(child(), endsAt, now)!.inSeconds).toBe(15 * 60);
  });

  it('is skipped entirely on a session too short to warn about', () => {
    const now = new Date('2026-08-20T14:00:00.000Z');
    // Five minutes of screen time would mean buzzing as it starts.
    expect(sessionEndingSoon(child(), new Date('2026-08-20T14:05:00.000Z').toISOString(), now)).toBeNull();
    expect(sessionEndingSoon(child(), new Date('2026-08-20T14:02:00.000Z').toISOString(), now)).toBeNull();
  });
});
