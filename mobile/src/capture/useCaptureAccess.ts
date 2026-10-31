import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useCaptureStore } from './store';
import { captureSupported, hasSmsPermission, isNotificationAccessGranted } from './native';

/** Current permission state; re-checked whenever the app returns from Android settings. */
export function useCaptureAccess() {
  const smsEnabled = useCaptureStore((s) => s.settings.smsEnabled);
  const [state, setState] = useState(() => ({ smsPermission: hasSmsPermission(), notifications: isNotificationAccessGranted() }));

  useEffect(() => {
    const check = () => setState({ smsPermission: hasSmsPermission(), notifications: isNotificationAccessGranted() });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => sub.remove();
  }, []);

  const recheck = () => setState({ smsPermission: hasSmsPermission(), notifications: isNotificationAccessGranted() });
  const sms = smsEnabled && state.smsPermission;
  return { supported: captureSupported, sms, smsPermission: state.smsPermission, notifications: state.notifications, any: sms || state.notifications, recheck };
}
