import { NotificationPayload } from '@/domain/notifications';

import { NotificationService } from './NotificationService';

/**
 * Nowhere to deliver: the web preview, and any build without the native module.
 *
 * It reports `available: false` so the settings screen can say so, rather than
 * offering a switch that turns nothing on.
 */
export class NullNotificationService implements NotificationService {
  readonly name = 'none';
  readonly available = false;

  async permission() {
    return 'undetermined' as const;
  }

  async requestPermission() {
    return false;
  }

  async schedule(_payload: NotificationPayload): Promise<string | null> {
    return null;
  }

  async cancel(): Promise<void> {}
  async cancelKind(): Promise<void> {}

  async pushToken(): Promise<string | null> {
    return null;
  }
}
