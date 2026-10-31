import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useCaptureRules, useGroups, useMe, useSmsTemplates } from '@/api/queries';
import { useAuthStore } from '@/store/auth';
import { captureSupported, onPaymentNotification } from './native';
import { useCaptureStore } from './store';
import { syncCapture, type SyncContext } from './sync';

const MIN_GAP_MS = 15_000;

/**
 * Mounted once (tabs layout). Loads this user's inbox, then scans for new payments
 * when the app opens / comes back to the foreground, and live when GPay & co. post a notification.
 */
export function useCaptureSync() {
  const qc = useQueryClient();
  const me = useMe();
  const userId = useAuthStore((s) => s.user?.id ?? null) ?? me.data?.id ?? null;
  const hydrated = useCaptureStore((s) => s.hydrated && s.userId === userId);
  const rules = useCaptureRules();
  const templates = useSmsTemplates();
  const groups = useGroups();
  const last = useRef(0);

  useEffect(() => {
    if (userId) useCaptureStore.getState().hydrate(userId);
  }, [userId]);

  const ctxRef = useRef<SyncContext | null>(null);
  ctxRef.current = userId
    ? { meId: userId, rules: rules.data ?? [], groups: groups.data ?? [], templates: templates.data ?? [], qc }
    : null;
  // Wait for rules + groups so auto-save rules are honoured on the first scan.
  const ready = captureSupported && hydrated && !!userId && !rules.isLoading && !groups.isLoading;

  const sync = useCallback((force = false, sms = true) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const now = Date.now();
    if (!force && now - last.current < MIN_GAP_MS) return;
    last.current = now;
    syncCapture(ctx, { sms }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!ready) return;
    sync(true);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    const live = onPaymentNotification(() => {
      const ctx = ctxRef.current;
      if (ctx) syncCapture(ctx, { sms: false }).catch(() => undefined);
    });
    return () => {
      app.remove();
      live();
    };
  }, [ready, sync]);
}

/** For pull-to-refresh / "Scan now" buttons. */
export function useCaptureScan() {
  const qc = useQueryClient();
  const me = useMe();
  const userId = useAuthStore((s) => s.user?.id ?? null) ?? me.data?.id ?? null;
  const rules = useCaptureRules();
  const templates = useSmsTemplates();
  const groups = useGroups();
  return useCallback(async () => {
    if (!userId || !captureSupported) return { added: 0, autoSaved: 0, ignored: 0 };
    return syncCapture({ meId: userId, rules: rules.data ?? [], groups: groups.data ?? [], templates: templates.data ?? [], qc });
  }, [userId, rules.data, groups.data, templates.data, qc]);
}
