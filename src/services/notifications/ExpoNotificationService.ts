import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { NotificationPayload } from '@/domain/notifications';

import { NotificationService } from './NotificationService';

/**
 * Real notifications, through Expo.
 *
 * Scheduled ones carry their kind in the payload data, so `cancelKind` can find
 * them later — a five-minute warning has to disappear the moment a child stops
 * their session early, and there is no other way to recognise it afterwards.
 */
export class ExpoNotificationService implements NotificationService {
  readonly name = 'expo';
  readonly available = true;

  constructor() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        // Quiet hours are enforced upstream, in the domain; a sound here would
        // undo that decision for a notification that got through anyway.
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      // Android needs the channel to exist before anything is posted to it.
      Notifications.setNotificationChannelAsync('mino', {
        name: 'Mino',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200],
        lightColor: '#4EB6FF',
      }).catch(() => undefined);
    }
  }

  async permission() {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted' as const;
    if (status === 'denied') return 'denied' as const;
    return 'undetermined' as const;
  }

  async requestPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async schedule(payload: NotificationPayload): Promise<string | null> {
    try {
      return await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: { kind: payload.kind, route: payload.route, childId: payload.childId },
        },
        trigger:
          payload.inSeconds && payload.inSeconds > 0
            ? {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: payload.inSeconds,
                channelId: 'mino',
              }
            : null,
      });
    } catch {
      // A notification that fails to schedule must never take an action down
      // with it: the mission was still completed.
      return null;
    }
  }

  async cancel(id: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }

  async cancelKind(kind: NotificationPayload['kind']): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.kind === kind)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    ).catch(() => undefined);
  }

  async pushToken(): Promise<string | null> {
    try {
      const { data } = await Notifications.getExpoPushTokenAsync();
      return data;
    } catch {
      // No project id, no network, or a simulator: all of them mean "no push",
      // and none of them is worth an error in front of a parent.
      return null;
    }
  }
}
