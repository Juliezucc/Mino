import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { ScreenTimeAuthorization } from './ScreenTimeService';

/**
 * The contract the native modules must satisfy.
 *
 * Declaring it here, on the JavaScript side, is what lets the whole product be
 * built and tested before a single line of Swift or Kotlin exists: the fallback
 * service and the real ones implement the same interface, and the screens never
 * learn which one they got.
 *
 * iOS — `MinoScreenTime`, backed by FamilyControls / ManagedSettings /
 * DeviceActivity. `shield` writes the ManagedSettingsStore, `unshield` clears it
 * and schedules a DeviceActivity monitor to put it back at `until`.
 *
 * Android — the same module name, backed by UsageStatsManager plus an overlay
 * service. `shield` starts the watcher, `unshield` pauses it until `until`.
 *
 * The extension has to be able to re-shield on its own, without the network and
 * without the app running: `unshield` therefore takes the deadline rather than
 * expecting a later call.
 */
export interface NativeScreenTime {
  authorizationStatus(): Promise<ScreenTimeAuthorization>;
  requestAuthorization(): Promise<ScreenTimeAuthorization>;

  /** Opens the system app picker. Resolves with how many entries were chosen. */
  presentPicker(): Promise<{ count: number }>;
  selectionCount(): Promise<{ count: number }>;

  /** Blocks the selected apps. Called once, at setup, and after every session. */
  shield(): Promise<void>;
  /** Lifts the shield until `until` (epoch milliseconds), then it returns by itself. */
  unshield(until: number): Promise<void>;
  /** Milliseconds left on the current lift, or 0 when the shield is up. */
  remaining(): Promise<number>;
}

/**
 * The native module, or null when this build does not include it — Expo Go, the
 * web export, and every build made before the modules land. Null is a supported
 * state, not an error: the app falls back to the in-app timer and says so.
 */
export function getNativeScreenTime(): NativeScreenTime | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  // `requireOptionalNativeModule` rend `null` au lieu de jeter quand le module
  // n'est pas dans la build : c'est exactement l'état d'Expo Go, et il est
  // prévu. L'ancien `NativeModules.MinoScreenTime` visait le pont hérité de
  // React Native, où un module Expo ne s'enregistre pas — il n'aurait jamais
  // rien trouvé, même une fois le module écrit.
  return requireOptionalNativeModule<NativeScreenTime>('MinoScreenTime');
}
