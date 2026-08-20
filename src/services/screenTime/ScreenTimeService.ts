import { ID } from '@/domain/types';

/**
 * The seam between Mino and real device screen-time control.
 *
 * Where the product is going: the apps on the child's phone or tablet stay
 * shielded by default, and Mino lifts the shield for exactly the time the child
 * earned. That is a privilege only the operating system grants — through
 * Apple's FamilyControls on iOS, and through the usage-access and overlay
 * permissions on Android — so it lives behind this interface and nowhere else.
 *
 * Until the native modules ship, `LocalTimerScreenTimeService` runs an honest
 * in-app countdown and says so. Three strings in the app read `capability` and
 * reword themselves; nothing else knows how the time is enforced.
 *
 * See `docs/blocage-ecrans.md` for the plan and `docs/apple-family-controls.md`
 * for the authorisation Apple has to grant first.
 */

export type ScreenTimeCapability =
  /** In-app countdown only. Nothing is blocked at OS level. */
  | 'timer-only'
  /** The OS shields apps, and Mino lifts the shield for the granted duration. */
  | 'device-managed';

export type ScreenTimeAuthorization =
  /** This platform or build cannot enforce anything — nothing to ask for. */
  | 'unsupported'
  /** Never asked yet. */
  | 'not-determined'
  /** The parent said no. Everything still works, minus the enforcement. */
  | 'denied'
  /** Granted: Mino may shield and unshield. */
  | 'approved';

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

/** What the parent chose to put behind the shield. */
export interface ShieldedSelection {
  /**
   * How many apps and categories are covered. Apple never tells us WHICH —
   * the picker hands back opaque tokens — so a count is all the UI can honestly
   * show, and that privacy property is one we are glad to have.
   */
  count: number;
}

export interface ScreenTimeService {
  readonly name: string;
  readonly capability: ScreenTimeCapability;

  authorization(): Promise<ScreenTimeAuthorization>;
  /** Prompts the parent. Returns the resulting state, never throws on refusal. */
  requestAuthorization(): Promise<ScreenTimeAuthorization>;

  /** Opens the system picker so the parent chooses what Mino shields. */
  chooseApps(): Promise<ShieldedSelection>;
  selection(): Promise<ShieldedSelection>;

  /** Opens the allowance. On a device-managed implementation this lifts the shield. */
  grant(params: { sessionId: ID; childId: ID; minutes: number }): Promise<ScreenTimeGrant>;
  /** Closes the allowance early or at expiry. Returns the minutes actually used. */
  revoke(sessionId: ID): Promise<{ consumedMinutes: number }>;
  status(childId: ID): Promise<ScreenTimeStatus>;
}
