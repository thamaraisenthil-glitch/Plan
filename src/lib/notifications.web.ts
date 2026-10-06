// The app targets iOS and Android; the web build is only used for quick
// previews, so alarms are a no-op there.
import type { AppState } from './logic';

export const SNOOZE_ACTION = 'snooze';
export const SNOOZE_MINUTES = 5;

export async function getPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  return 'denied';
}
export async function requestPermission(): Promise<boolean> {
  return false;
}
export async function syncNotifications(_state: AppState): Promise<void> {}
export async function snooze(_title: string, _eventId?: unknown): Promise<void> {}
export async function sendTestAlarm(): Promise<void> {}
export function useNotificationResponses(_onOpen: () => void, _onSnoozed: () => void) {}
