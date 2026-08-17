import { ID } from '@/domain/types';

/**
 * The seam between Mino and real device screen-time control.
 *
 * The MVP ships `LocalTimerScreenTimeService`, which only runs an in-app timer.
 * Plugging in Apple's FamilyControls / DeviceActivity or Android's
 * UsageStatsManager + device admin later means writing one more class here —
 * no screen, store or domain code changes.
 */

export type ScreenTimeCapability =
  /** In-app countdown only. Nothing is blocked at OS level. */
  | 'timer-only'
  /** The OS can unlock/lock apps for the granted duration. */
  | 'device-managed';

export interface ScreenTimeGrant {
  sessionId: ID;
  childId: ID;
  minutes: number;
  startedAt: string;
  endsAt: string;
}

export interface ScreenTimeStatus {
  active: boolean;
  grant?: ScreenTimeGrant;
  remainingSeconds: number;
}

export interface ScreenTimeService {
  readonly capability: ScreenTimeCapability;
  /** True once the platform permissions (if any) have been granted. */
  isAuthorized(): Promise<boolean>;
  requestAuthorization(): Promise<boolean>;
  /** Opens the allowance. On a device-managed implementation this unblocks apps. */
  grant(params: { sessionId: ID; childId: ID; minutes: number }): Promise<ScreenTimeGrant>;
  /** Closes the allowance early or at expiry. Returns the minutes actually used. */
  revoke(sessionId: ID): Promise<{ consumedMinutes: number }>;
  status(childId: ID): Promise<ScreenTimeStatus>;
}
