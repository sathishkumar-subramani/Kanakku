import { requireOptionalNativeModule, type EventSubscription } from 'expo';
import { PermissionsAndroid, Platform } from 'react-native';

import type { RawMessage } from './parser';

/** Shape of the local Kotlin module in modules/kanakku-capture. */
type CaptureNative = {
  hasSmsPermission(): boolean;
  readSms(sinceMillis: number, limit: number): Promise<RawMessage[]>;
  isNotificationAccessGranted(): boolean;
  openNotificationAccessSettings(): boolean;
  pendingNotificationCount(): number;
  drainNotifications(): RawMessage[];
  addListener(event: 'onPaymentNotification', cb: (e: { item: RawMessage }) => void): EventSubscription;
};

/** null on web, in Expo Go, or in an APK built before the module existed. */
const native = Platform.OS === 'android' ? requireOptionalNativeModule<CaptureNative>('KanakkuCapture') : null;

export const captureSupported = native != null;

export function hasSmsPermission(): boolean {
  try {
    return native?.hasSmsPermission() ?? false;
  } catch {
    return false;
  }
}

/** Shows Android's "Allow Kanakku to view SMS?" prompt. */
export async function requestSmsPermission(): Promise<'granted' | 'denied' | 'blocked'> {
  if (!native) return 'denied';
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read bank SMS?',
    message:
      'Kanakku reads only bank / UPI transaction messages to find your payments. Messages stay on this phone — only payments you confirm are saved.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  if (res === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

export async function readSms(sinceMillis: number, limit = 500): Promise<RawMessage[]> {
  if (!native || !hasSmsPermission()) return [];
  try {
    return await native.readSms(sinceMillis, limit);
  } catch {
    return [];
  }
}

export function isNotificationAccessGranted(): boolean {
  try {
    return native?.isNotificationAccessGranted() ?? false;
  } catch {
    return false;
  }
}

export function openNotificationAccessSettings(): boolean {
  try {
    return native?.openNotificationAccessSettings() ?? false;
  } catch {
    return false;
  }
}

export function drainNotifications(): RawMessage[] {
  try {
    return native?.drainNotifications() ?? [];
  } catch {
    return [];
  }
}

export function onPaymentNotification(cb: (item: RawMessage) => void): () => void {
  if (!native) return () => {};
  const sub = native.addListener('onPaymentNotification', (e) => cb(e.item));
  return () => sub.remove();
}
