import { LocalTimerScreenTimeService } from './LocalTimerScreenTimeService';
import { ScreenTimeService } from './ScreenTimeService';

export * from './ScreenTimeService';
export { LocalTimerScreenTimeService };

let instance: ScreenTimeService | null = null;

/**
 * Single entry point used by the app.
 *
 * To ship real blocking later:
 *   1. add `IosFamilyControlsScreenTimeService` / `AndroidUsageStatsScreenTimeService`;
 *   2. pick it here by `Platform.OS` + authorization;
 *   3. nothing else in the codebase changes.
 */
export function getScreenTimeService(): ScreenTimeService {
  if (!instance) instance = new LocalTimerScreenTimeService();
  return instance;
}

/** Test hook. */
export function setScreenTimeService(service: ScreenTimeService | null) {
  instance = service;
}
