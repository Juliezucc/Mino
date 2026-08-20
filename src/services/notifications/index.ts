import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { ExpoNotificationService } from './ExpoNotificationService';
import { NotificationService } from './NotificationService';
import { NullNotificationService } from './NullNotificationService';

export * from './NotificationService';
export { ExpoNotificationService, NullNotificationService };

let instance: NotificationService | null = null;

/**
 * Real notifications on a device, nothing on the web preview.
 *
 * Expo Go no longer carries remote push, and local scheduling there is not
 * worth pretending about either — so the app says plainly that notifications
 * need a real build rather than offering a switch that does nothing.
 */
export function getNotificationService(): NotificationService {
  if (!instance) {
    const isDevice = Platform.OS === 'ios' || Platform.OS === 'android';
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    instance = isDevice && !isExpoGo ? new ExpoNotificationService() : new NullNotificationService();
  }
  return instance;
}

/** Test hook. */
export function setNotificationService(service: NotificationService | null) {
  instance = service;
}
