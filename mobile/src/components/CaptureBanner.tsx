import { useRouter } from 'expo-router';
import { ChevronRight, Inbox, X, Zap } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCaptureStore, usePendingCount } from '@/capture/store';
import { useCaptureAccess } from '@/capture/useCaptureAccess';
import { useTheme } from '@/theme/ThemeProvider';
import { pluralize } from '@/utils/misc';
import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

/** Home: "3 payments to sort" — or, before capture is on, a one-time invite to turn it on. */
export function CaptureBanner() {
  const t = useTheme();
  const router = useRouter();
  const access = useCaptureAccess();
  const pending = usePendingCount();
  const dismissed = useCaptureStore((s) => s.settings.setupDismissed);
  const hydrated = useCaptureStore((s) => s.hydrated);

  if (!access.supported || !hydrated) return null;

  if (pending > 0) {
    return (
      <Card padded={false} onPress={() => router.push('/capture')} style={[styles.card, { borderColor: t.colors.accent }]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: t.colors.accent }]}>
            <Inbox size={18} color={t.colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="semibold">
              {pending} {pluralize(pending, 'payment')} to sort
            </Text>
            <Text variant="micro" tone="muted">
              From your bank SMS & UPI apps · one tap each
            </Text>
          </View>
          <ChevronRight size={18} color={t.colors.muted} />
        </View>
      </Card>
    );
  }

  if (!access.any && !dismissed) {
    return (
      <Card style={styles.card}>
        <View style={[styles.row, { padding: 0, alignItems: 'flex-start' }]}>
          <View style={[styles.icon, { backgroundColor: t.colors.accentSoft }]}>
            <Zap size={18} color={t.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="semibold">Add GPay payments without typing</Text>
            <Text variant="small" tone="muted" style={{ marginTop: 2 }}>
              Kanakku can spot payments from your bank SMS and UPI apps. You pick Personal, Group or Settle up.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Button title="Turn on" size="sm" onPress={() => router.push('/more/capture')} />
              <Button title="Not now" size="sm" variant="ghost" onPress={() => useCaptureStore.getState().setSettings({ setupDismissed: true })} />
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={8} onPress={() => useCaptureStore.getState().setSettings({ setupDismissed: true })}>
            <X size={16} color={t.colors.muted} />
          </Pressable>
        </View>
      </Card>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
