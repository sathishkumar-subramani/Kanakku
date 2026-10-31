import { useRouter } from 'expo-router';
import { Bell, Inbox, MessageSquareText, RefreshCw, ShieldCheck, Trash2, Zap } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';

import { errorMessage } from '@/api';
import { useCaptureRules, useDeleteCaptureRule, useGroups } from '@/api/queries';
import type { CaptureRule, Group } from '@/api/types';
import { openNotificationAccessSettings, requestSmsPermission } from '@/capture/native';
import { usePendingCount, useCaptureStore } from '@/capture/store';
import { useCaptureAccess } from '@/capture/useCaptureAccess';
import { useCaptureScan } from '@/capture/useCaptureSync';
import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { Header, Screen } from '@/components/Screen';
import { EmptyState, SkeletonRows } from '@/components/States';
import { Text } from '@/components/Text';
import { categoryMeta } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { hapticSuccess } from '@/utils/misc';

export default function CaptureSettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const access = useCaptureAccess();
  const pending = usePendingCount();
  const scan = useCaptureScan();
  const rules = useCaptureRules();
  const groups = useGroups();
  const del = useDeleteCaptureRule();
  const [scanning, setScanning] = useState(false);

  const toggleSms = async (on: boolean) => {
    const store = useCaptureStore.getState();
    if (!on) {
      store.setSettings({ smsEnabled: false });
      return;
    }
    const res = access.smsPermission ? 'granted' : await requestSmsPermission();
    access.recheck();
    if (res === 'granted') {
      store.setSettings({ smsEnabled: true });
      await runScan();
    } else if (res === 'blocked') {
      Alert.alert('SMS permission is off', 'Allow "SMS" for Kanakku in Android settings → Apps → Kanakku → Permissions.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
    }
  };

  const openNotif = () => {
    if (!openNotificationAccessSettings()) Linking.openSettings();
  };

  const runScan = async () => {
    setScanning(true);
    try {
      const r = await scan();
      hapticSuccess();
      if (r.added === 0) Alert.alert('No new payments', 'Everything is already in your inbox.');
      else router.push('/capture');
    } catch (err) {
      Alert.alert("Couldn't scan", errorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  const rescan = () => {
    Alert.alert('Scan the last 30 days again?', 'Payments you already saved or skipped stay as they are.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Scan',
        onPress: () => {
          useCaptureStore.getState().setSettings({ lastSmsScan: 0 });
          runScan();
        },
      },
    ]);
  };

  const removeRule = (r: CaptureRule) => {
    Alert.alert(`Forget ${r.label || r.key}?`, 'Future payments here will wait in the inbox again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget', style: 'destructive', onPress: () => del.mutate(r.id, { onError: (err) => Alert.alert("Couldn't remove", errorMessage(err)) }) },
    ]);
  };

  const clearInbox = () => {
    Alert.alert('Clear the inbox on this phone?', 'Saved expenses are not touched. Payments still in your SMS can be found again with a scan.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => useCaptureStore.getState().clearInbox() },
    ]);
  };

  if (!access.supported) {
    return (
      <Screen header={<Header title="Auto-add payments" />}>
        <Card>
          <EmptyState emoji="📲" title="Needs the latest Android app" body="Install the newest Kanakku APK to read bank SMS and UPI notifications." compact />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen header={<Header title="Auto-add payments" subtitle="Bank SMS and GPay / PhonePe / Paytm" />}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <IconBox icon={<MessageSquareText size={18} color={t.colors.accent} />} />
          <View style={{ flex: 1 }}>
            <Text weight="medium">Bank SMS</Text>
            <Text variant="micro" tone="muted">
              Debit / credit alerts from any bank — card, UPI, ATM. Personal chats are never read.
            </Text>
          </View>
          <Switch value={access.sms} onValueChange={toggleSms} trackColor={{ true: t.colors.accent, false: t.colors.border }} thumbColor="#FFFFFF" />
        </View>
        <Divider inset={44} />
        <View style={styles.row}>
          <IconBox icon={<Bell size={18} color={t.colors.accent} />} />
          <View style={{ flex: 1 }}>
            <Text weight="medium">UPI app notifications</Text>
            <Text variant="micro" tone="muted">
              {access.notifications
                ? 'On — payments in GPay, PhonePe, Paytm, BHIM… show up even when the app is closed.'
                : 'Gives the person’s name for UPI payments. Android asks you to allow "Notification access" for Kanakku.'}
            </Text>
          </View>
          {access.notifications ? (
            <Text variant="small" tone="positive" weight="semibold">
              On
            </Text>
          ) : (
            <Button title="Allow" size="sm" variant="secondary" onPress={openNotif} />
          )}
        </View>
      </Card>

      <View style={styles.privacy}>
        <ShieldCheck size={16} color={t.colors.positive} />
        <Text variant="small" tone="muted" style={{ flex: 1 }}>
          Messages are read and understood on this phone. Kanakku's server only gets the expenses you save, your payee rules, and — if you teach a new SMS format — a few words around the amount (never amounts, names or account numbers).
        </Text>
      </View>

      <Card style={styles.card} padded={false}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/capture')} style={({ pressed }) => [styles.row, styles.pad, pressed && { backgroundColor: t.colors.surface2 }]}>
          <IconBox icon={<Inbox size={18} color={t.colors.accent} />} />
          <View style={{ flex: 1 }}>
            <Text weight="medium">Payments inbox</Text>
            <Text variant="micro" tone="muted">
              {pending > 0 ? `${pending} waiting to be sorted` : 'All sorted'}
            </Text>
          </View>
        </Pressable>
        <Divider inset={58} />
        <Pressable accessibilityRole="button" disabled={!access.any || scanning} onPress={access.sms ? rescan : runScan} style={({ pressed }) => [styles.row, styles.pad, { opacity: access.any ? 1 : 0.5 }, pressed && { backgroundColor: t.colors.surface2 }]}>
          <IconBox icon={<RefreshCw size={18} color={t.colors.accent} />} />
          <View style={{ flex: 1 }}>
            <Text weight="medium">{scanning ? 'Scanning…' : access.sms ? 'Scan last 30 days again' : 'Check now'}</Text>
            <Text variant="micro" tone="muted">
              Kanakku also checks every time you open the app.
            </Text>
          </View>
        </Pressable>
      </Card>

      <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
        REMEMBERED PAYEES
      </Text>
      <Card style={styles.card} padded={false}>
        {rules.isLoading ? (
          <View style={{ padding: 14 }}>
            <SkeletonRows rows={2} />
          </View>
        ) : (rules.data ?? []).length === 0 ? (
          <View style={{ padding: 14 }}>
            <Text variant="small" tone="muted">
              When you sort a payment with “Remember” on, the payee shows up here.
            </Text>
          </View>
        ) : (
          (rules.data ?? []).map((r, i) => (
            <View key={r.id}>
              {i > 0 ? <Divider inset={14} /> : null}
              <View style={[styles.row, styles.pad]}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {r.label || r.key.replace(/^name:/, '')}
                    </Text>
                    {r.autoSave ? <Zap size={14} color={t.colors.accent} /> : null}
                  </View>
                  <Text variant="micro" tone="muted" numberOfLines={1}>
                    {describeRule(r, groups.data ?? [])}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Forget ${r.label}`} hitSlop={8} onPress={() => removeRule(r)} style={[styles.trash, { backgroundColor: t.colors.surface2 }]}>
                  <Trash2 size={16} color={t.colors.negative} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>

      <Button title="Clear inbox on this phone" variant="ghost" onPress={clearInbox} />
      <View style={{ height: 24 }} />
    </Screen>
  );
}

function IconBox({ icon }: { icon: React.ReactNode }) {
  const t = useTheme();
  return <View style={[styles.icon, { backgroundColor: t.colors.accentSoft }]}>{icon}</View>;
}

function describeRule(r: CaptureRule, groups: Group[]): string {
  const g = r.groupId ? groups.find((x) => x.id === r.groupId) : undefined;
  const auto = r.autoSave ? ' · automatic' : '';
  switch (r.kind) {
    case 'ignore':
      return 'Always skip';
    case 'personal':
      return `Personal · ${categoryMeta(r.category ?? 'other').label}${auto}`;
    case 'group':
      return `${g ? `${g.emoji} ${g.name}` : 'Group'} · ${r.splitWith.length ? `split ${r.splitWith.length}` : 'split with everyone'}${auto}`;
    case 'settlement': {
      const who = g?.members.find((m) => m.userId === r.counterpartyUserId)?.name ?? 'roommate';
      return `Settle up with ${who}${auto}`;
    }
  }
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  pad: { paddingHorizontal: 14, paddingVertical: 12 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  privacy: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14, marginHorizontal: 4 },
  caps: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  trash: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
