import { ID } from '@/domain/types';

import {
  ScreenTimeAuthorization,
  ScreenTimeGrant,
  ScreenTimeService,
  ScreenTimeStatus,
  ShieldedSelection,
} from './ScreenTimeService';
import { NativeScreenTime } from './native';

/**
 * Real enforcement: the apps the parent chose stay shielded, and a session
 * lifts the shield for exactly the minutes the child earned.
 *
 * One implementation covers both platforms because both native modules expose
 * the same four verbs. What differs — FamilyControls on iOS, usage access plus
 * an overlay on Android — differs entirely below this line.
 *
 * The deadline is handed to the native side rather than kept here: the shield
 * has to come back even if the child force-quits Mino, which is precisely the
 * case a JavaScript timer cannot cover.
 */
export class DeviceManagedScreenTimeService implements ScreenTimeService {
  readonly name = 'device-managed';
  readonly capability = 'device-managed' as const;

  /** Kept only to bill the time used; the shield itself is the native side's. */
  private grants = new Map<ID, ScreenTimeGrant>();

  constructor(private readonly native: NativeScreenTime) {}

  authorization(): Promise<ScreenTimeAuthorization> {
    return this.native.authorizationStatus();
  }

  requestAuthorization(): Promise<ScreenTimeAuthorization> {
    return this.native.requestAuthorization();
  }

  async chooseApps(): Promise<ShieldedSelection> {
    const selection = await this.native.presentPicker();
    // Anything chosen goes behind the shield straight away, so the setup ends
    // in the state the parent expects rather than at the next session.
    if (selection.count > 0) await this.native.shield();
    return selection;
  }

  selection(): Promise<ShieldedSelection> {
    return this.native.selectionCount();
  }

  async grant(params: { sessionId: ID; childId: ID; minutes: number }): Promise<ScreenTimeGrant> {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + params.minutes * 60_000);

    await this.native.unshield(endsAt.getTime());

    const grant: ScreenTimeGrant = {
      sessionId: params.sessionId,
      childId: params.childId,
      minutes: params.minutes,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
    };
    this.grants.set(params.sessionId, grant);
    return grant;
  }

  async revoke(sessionId: ID): Promise<{ consumedMinutes: number }> {
    const grant = this.grants.get(sessionId);
    // Shield first, bill after: if anything below throws, the apps are already
    // locked again. The wrong failure mode here is a child left with an open
    // phone, not a minute mis-billed.
    await this.native.shield();
    if (!grant) return { consumedMinutes: 0 };
    this.grants.delete(sessionId);

    const elapsedMs = Date.now() - new Date(grant.startedAt).getTime();
    return {
      consumedMinutes: Math.min(grant.minutes, Math.max(0, Math.round(elapsedMs / 60_000))),
    };
  }

  async status(childId: ID): Promise<ScreenTimeStatus> {
    const grant = [...this.grants.values()].find((g) => g.childId === childId);
    // The native side is the authority on how long is left: it survives the app
    // being killed, and this map does not.
    const remainingMs = await this.native.remaining();
    const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));

    if (!grant) return { active: remainingSeconds > 0, remainingSeconds };
    return { active: remainingSeconds > 0, grant, remainingSeconds };
  }
}
