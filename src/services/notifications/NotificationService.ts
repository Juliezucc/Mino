import { NotificationPayload } from '@/domain/notifications';

/**
 * Delivering a notification, wherever it comes from.
 *
 * Two kinds of delivery hide behind this. A notification for the person holding
 * *this* device is scheduled locally and needs no server at all — the
 * five-minute warning, or a validation the parent just made on the same phone.
 * A notification for someone else's device is a push, and that needs a token
 * registered against the family.
 *
 * The screens never know which happened.
 */
export interface NotificationService {
  readonly name: string;
  /** False when nothing can be delivered — Expo Go, the web preview. */
  readonly available: boolean;

  permission(): Promise<'granted' | 'denied' | 'undetermined'>;
  requestPermission(): Promise<boolean>;

  /** Shows or schedules it on this device. Returns an id, to cancel it later. */
  schedule(payload: NotificationPayload): Promise<string | null>;
  cancel(id: string): Promise<void>;
  cancelKind(kind: NotificationPayload['kind']): Promise<void>;

  /** The push token for this device, once permission is granted. */
  pushToken(): Promise<string | null>;
}
