import { DeviceManagedScreenTimeService } from './DeviceManagedScreenTimeService';
import { LocalTimerScreenTimeService } from './LocalTimerScreenTimeService';
import { ScreenTimeService } from './ScreenTimeService';
import { getNativeScreenTime } from './native';

export * from './ScreenTimeService';
export { DeviceManagedScreenTimeService, LocalTimerScreenTimeService };
export type { NativeScreenTime } from './native';

let instance: ScreenTimeService | null = null;

/**
 * Single entry point used by the app.
 *
 * Real enforcement as soon as the build carries the native module; the honest
 * in-app timer everywhere else — Expo Go, the web preview, and any build made
 * before the modules land. No screen ever tests which one it got.
 */
export function getScreenTimeService(): ScreenTimeService {
  if (!instance) {
    const native = getNativeScreenTime();
    instance = native ? new DeviceManagedScreenTimeService(native) : new LocalTimerScreenTimeService();
  }
  return instance;
}

/** Test hook. */
export function setScreenTimeService(service: ScreenTimeService | null) {
  instance = service;
}
