import { requireOptionalNativeModule } from 'expo';

import type { NativeScreenTime } from '@/services/screenTime/native';

/**
 * Le module natif, ou rien.
 *
 * `requireOptionalNativeModule` et non `requireNativeModule` : dans Expo Go,
 * dans l'export web et dans toute build faite avant que ce module n'existe, il
 * n'y a pas de module natif — et ce n'est pas une panne, c'est un état prévu.
 * L'application retombe alors sur le minuteur honnête et le dit à l'écran
 * (`app/parent/blocage.tsx`).
 *
 * La différence avec la version précédente compte : le code lisait
 * `NativeModules.MinoScreenTime`, c'est-à-dire l'ancien pont de React Native.
 * L'application tourne en nouvelle architecture (`newArchEnabled` dans
 * `app.json`), et un module Expo ne s'y enregistre pas — il se demande.
 */
export const MinoScreenTime = requireOptionalNativeModule<NativeScreenTime>('MinoScreenTime');

export default MinoScreenTime;
