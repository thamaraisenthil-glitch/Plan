import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fmtTime } from './format';
import { planNotifications, type AppState, type PlannedNotification } from './logic';

export const ALARM_CHANNEL = 'alarms';
export const ALARM_CATEGORY = 'alarm';
export const SNOOZE_ACTION = 'snooze';
export const SNOOZE_MINUTES = 5;

// Show alarms as a banner with sound even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

let setupDone: Promise<void> | null = null;

function setup(): Promise<void> {
  setupDone ??= (async () => {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ALARM_CHANNEL, {
        name: 'Alarms',
        description: 'Schedule alarms and month-end reminders',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 400, 200, 400, 200, 400],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
    }
    await Notifications.setNotificationCategoryAsync(ALARM_CATEGORY, [
      // Opens the app so the snooze is scheduled even if the app had been closed.
      { identifier: SNOOZE_ACTION, buttonTitle: `Snooze ${SNOOZE_MINUTES} min`, options: { opensAppToForeground: true } },
      { identifier: 'dismiss', buttonTitle: 'Dismiss', options: { opensAppToForeground: false } },
    ]);
  })().catch((e) => {
    setupDone = null;
    throw e;
  });
  return setupDone;
}

export async function getPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const p = await Notifications.getPermissionsAsync();
  if (p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<boolean> {
  await setup();
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return p.granted;
}

function toTrigger(n: PlannedNotification): Notifications.NotificationTriggerInput {
  const channelId = ALARM_CHANNEL;
  const t = n.trigger;
  switch (t.kind) {
    case 'daily':
      return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute, channelId };
    case 'weekly':
      return { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: t.weekday, hour: t.hour, minute: t.minute, channelId };
    default:
      return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.at, channelId };
  }
}

function content(title: string, body: string, data: Record<string, unknown>, isAlarm: boolean): Notifications.NotificationContentInput {
  return {
    title,
    body,
    data,
    sound: 'default',
    ...(isAlarm ? { categoryIdentifier: ALARM_CATEGORY, interruptionLevel: 'timeSensitive' as const } : {}),
    priority: Notifications.AndroidNotificationPriority.MAX,
    vibrate: [0, 400, 200, 400],
  };
}

const MANAGED = /^(alarm|month)-/;
let queue: Promise<void> = Promise.resolve();

// Replaces every app-managed scheduled notification with the current plan.
// Snoozes are left alone. Calls are serialised so rapid edits can't interleave.
export function syncNotifications(state: AppState): Promise<void> {
  queue = queue.then(async () => {
    if ((await getPermission()) !== 'granted') return;
    await setup();
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      existing.filter((n) => MANAGED.test(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
    for (const n of planNotifications(state, new Date(), fmtTime)) {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: content(n.title, n.body, { kind: n.kind, eventId: n.eventId }, n.kind === 'alarm'),
        trigger: toTrigger(n),
      });
    }
  }).catch(() => {});
  return queue;
}

export async function snooze(title: string, eventId?: unknown): Promise<void> {
  await setup();
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze-${Date.now()}`,
    content: content(title, 'Snoozed alarm', { kind: 'alarm', eventId }, true),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: Date.now() + SNOOZE_MINUTES * 60000, channelId: ALARM_CHANNEL },
  });
}

export async function sendTestAlarm(): Promise<void> {
  await setup();
  await Notifications.scheduleNotificationAsync({
    identifier: `snooze-test-${Date.now()}`,
    content: content('Test alarm ⏰', 'If you can see and hear this, alarms are working.', { kind: 'alarm' }, true),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: ALARM_CHANNEL },
  });
}

// Handles taps on alarm notifications, including the one that launched the app.
export function useNotificationResponses(onOpen: () => void, onSnoozed: () => void) {
  useEffect(() => {
    const handle = (r: Notifications.NotificationResponse) => {
      const req = r.notification.request;
      if (r.actionIdentifier === SNOOZE_ACTION) {
        snooze(req.content.title ?? 'Alarm', req.content.data?.eventId).then(onSnoozed, () => {});
      } else if (r.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
        onOpen();
      }
      Notifications.dismissNotificationAsync(req.identifier).catch(() => {});
      Notifications.clearLastNotificationResponse();
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) handle(last);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
