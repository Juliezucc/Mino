import { unitOf } from './ageBand';
import { describeDevice } from './devices';
import { formatTime } from './minos';
import { Child, Device, FamilyData, ID, Mission } from './types';

/**
 * What Mino is allowed to interrupt someone for.
 *
 * The loop only works if both ends hear about it. A parent who does not know a
 * mission is waiting validates it tomorrow, and a child who waits until
 * tomorrow stops connecting the effort to the reward — which is the one thing
 * the product exists to connect.
 *
 * That makes restraint the hard part, not delivery. Every notification here has
 * to pass the same test: would a parent thank us for this at 21h on a Tuesday?
 * Anything that is merely interesting does not qualify.
 */

export type NotificationAudience = 'parents' | 'child';

export type NotificationKind =
  /** A child says a mission is done and is waiting on a parent. */
  | 'mission.completed'
  /** A mission that counts itself: the parent is told, not asked. */
  | 'mission.counted'
  /** A child asks for time on a screen a parent has to start. */
  | 'session.requested'
  /** The parent said yes: the minutes have landed. */
  | 'completion.approved'
  /** The parent said no. Sent gently, and only once. */
  | 'completion.rejected'
  /** A gift, outside of any mission. */
  | 'bonus.granted'
  /** Five minutes left, so the end is not a surprise. */
  | 'session.endingSoon'
  /** The trial is about to become a payment. */
  | 'trial.ending';

export interface NotificationPayload {
  kind: NotificationKind;
  audience: NotificationAudience;
  /** Who it concerns, so a device showing one child can filter. */
  childId?: ID;
  title: string;
  body: string;
  /** Where tapping it should land. */
  route?: string;
  /** Seconds from now. Absent means "right away". */
  inSeconds?: number;
}

/**
 * Quiet hours, non-negotiable.
 *
 * A child's device buzzing at 22h40 is exactly the thing a screen-time app must
 * never do. Parents are left alone at night too — a mission validated at
 * midnight helps nobody.
 */
export const QUIET_FROM_HOUR = 20;
export const QUIET_UNTIL_HOUR = 7;

export function isQuietHour(date: Date): boolean {
  const hour = date.getHours();
  return hour >= QUIET_FROM_HOUR || hour < QUIET_UNTIL_HOUR;
}

export interface NotificationPreferences {
  /** The parent can turn off their own alerts; the child's are separate. */
  parents: boolean;
  child: boolean;
  /** Off only for a family that has decided otherwise, deliberately. */
  quietHours: boolean;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  parents: true,
  child: true,
  quietHours: true,
};

/**
 * Whether this notification may actually be delivered right now.
 *
 * One kind ignores quiet hours: the five-minute warning. Staying silent there
 * would mean a screen going dark with no notice, which is worse than a buzz.
 */
export function shouldDeliver(
  payload: NotificationPayload,
  preferences: NotificationPreferences,
  now: Date = new Date(),
): boolean {
  if (payload.audience === 'parents' && !preferences.parents) return false;
  if (payload.audience === 'child' && !preferences.child) return false;

  if (!preferences.quietHours) return true;
  if (payload.kind === 'session.endingSoon') return true;
  return !isQuietHour(now);
}

/* --------------------------------------------------------------- builders */

export function missionCompleted(child: Child, mission: Mission): NotificationPayload {
  return {
    kind: 'mission.completed',
    audience: 'parents',
    childId: child.id,
    title: `${child.firstName} a terminé une mission`,
    body: `${mission.icon} ${mission.title} · ${mission.minutes} min si c’est fait`,
    route: '/parent',
  };
}

/**
 * Une mission qui s'est comptée toute seule.
 *
 * Le parent est prévenu, mais rien ne l'attend : il a décidé d'avance de faire
 * confiance sur cette mission-là. La différence de ton n'est pas cosmétique —
 * une notification qui ressemble à une demande et n'en est pas apprend au
 * parent à ne plus les ouvrir, et c'est alors la vraie demande qu'il ratera.
 */
export function missionCountedItself(child: Child, mission: Mission): NotificationPayload {
  // L'unité vient de l'enfant, comme partout ailleurs : le parent lit toujours
  // des minutes, mais la formule est la même fonction pour ne pas diverger.
  const unit = unitOf(child);
  return {
    kind: 'mission.counted',
    audience: 'parents',
    childId: child.id,
    title: `${child.firstName} a fait « ${mission.title} »`,
    body: `${mission.icon} ${formatTime(mission.minutes, unit, { signed: true })} · comptée sans confirmation, comme vous l’aviez choisi.`,
    route: '/parent',
  };
}

export function sessionRequested(
  child: Child,
  minutes: number,
  devices: Device[] | undefined,
  deviceId: ID | undefined,
): NotificationPayload {
  return {
    kind: 'session.requested',
    audience: 'parents',
    childId: child.id,
    title: `${child.firstName} demande du temps d’écran`,
    body: `${minutes} min sur ${describeDevice(devices, deviceId)}`,
    route: '/parent',
  };
}

export function completionApproved(child: Child, minutes: number): NotificationPayload {
  const unit = unitOf(child);
  return {
    kind: 'completion.approved',
    audience: 'child',
    childId: child.id,
    title: unit === 'minos' ? 'Mission validée ! 🎉' : 'Mission validée',
    body: `Tu as gagné ${formatTime(minutes, unit)}.`,
    route: '/child',
  };
}

export function completionRejected(child: Child, mission: Mission): NotificationPayload {
  return {
    kind: 'completion.rejected',
    audience: 'child',
    childId: child.id,
    // No blame, no exclamation mark: the mission simply comes back.
    title: 'Mission à refaire',
    body: `${mission.icon} ${mission.title} est de retour dans tes missions.`,
    route: '/child/missions',
  };
}

export function bonusGranted(child: Child, minutes: number, reason: string): NotificationPayload {
  const unit = unitOf(child);
  return {
    kind: 'bonus.granted',
    audience: 'child',
    childId: child.id,
    title: `🎁 ${formatTime(minutes, unit)} offert${minutes > 1 ? 's' : ''} !`,
    body: reason,
    route: '/child',
  };
}

/** Scheduled when a session starts, cancelled if it ends early. */
export function sessionEndingSoon(
  child: Child,
  endsAt: string,
  now: Date = new Date(),
): NotificationPayload | null {
  const warnAt = new Date(endsAt).getTime() - 5 * 60_000;
  const inSeconds = Math.round((warnAt - now.getTime()) / 1000);
  // A session shorter than the warning gets no warning: buzzing at the very
  // moment it starts would just be noise.
  if (inSeconds < 30) return null;

  return {
    kind: 'session.endingSoon',
    audience: 'child',
    childId: child.id,
    title: 'Plus que 5 minutes',
    body: 'Pense à finir ce que tu fais.',
    route: '/child/session',
    inSeconds,
  };
}

export function trialEnding(daysLeft: number): NotificationPayload {
  return {
    kind: 'trial.ending',
    audience: 'parents',
    title: `Votre essai se termine dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
    body: 'Vous pouvez choisir votre formule ou arrêter, en quelques secondes.',
    route: '/parent/abonnement',
  };
}

/** Convenience for the store: find the child a notification is about. */
export function childOf(data: FamilyData | null, childId: ID | undefined): Child | undefined {
  if (!data || !childId) return undefined;
  return data.children.find((c) => c.id === childId);
}
