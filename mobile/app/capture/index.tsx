import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check, ChevronDown, ChevronUp, Settings2, ShieldCheck } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useCaptureRules, useGroups, useMe } from '@/api/queries';
import type { Group } from '@/api/types';
import { AlreadyRecordedError, saveCaptured, unsaveCaptured } from '@/capture/save';
import { useCaptureStore, type InboxItem } from '@/capture/store';
import { describeSuggestion, displayName, suggestFor, type Suggestion } from '@/capture/suggest';
import { choiceFrom } from '@/capture/sync';
import { useCaptureAccess } from '@/capture/useCaptureAccess';
import { useCaptureScan } from '@/capture/useCaptureSync';
import { Button } from '@/components/Button';
import { DirIcon, sourceLabel, timeLabel } from '@/components/CaptureBits';
import { Card, Divider } from '@/components/Card';
import { Header, Screen } from '@/components/Screen';
import { EmptyState } from '@/components/States';
import { Money, Text } from '@/components/Text';
import { categoryMeta } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayHeading, groupByDay } from '@/utils/dates';
import { hapticError, hapticSuccess } from '@/utils/misc';
import { formatMoney } from '@/utils/money';

export default function CaptureInboxScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const groups = useGroups();
  const rules = useCaptureRules();
  const items = useCaptureStore((s) => s.items);
  const access = useCaptureAccess();
  const captureSupported = access.supported;
  const scan = useCaptureScan();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);

  const meId = me.data?.id ?? '';
  const currency = me.data?.currency ?? 'INR';
  const ctx = useMemo(() => ({ rules: rules.data ?? [], groups: groups.data ?? [], meId }), [rules.data, groups.data, meId]);

  const all = useMemo(() => Object.values(items).sort((a, b) => b.timestamp - a.timestamp), [items]);
  const pending = all.filter((i) => i.status === 'pending');
  const weekAgo = Date.now() - 7 * 86_400_000;
  const done = all.filter((i) => (i.status === 'saved' || i.status === 'recorded') && (i.handledAt ?? 0) >= weekAgo).sort((a, b) => (b.handledAt ?? 0) - (a.handledAt ?? 0));
  const skipped = all.filter((i) => i.status === 'ignored');

  const setUp = access.any;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await scan();
    } finally {
      setRefreshing(false);
    }
  };

  const quickSave = async (item: InboxItem, s: Suggestion) => {
    const choice = choiceFrom(item, s);
    if (!choice || !meId) return;
    setBusy(item.key);
    try {
      const saved = await saveCaptured(item, choice, meId, qc);
      useCaptureStore.getState().setStatus(item.key, 'saved', saved);
      hapticSuccess();
    } catch (err) {
      if (err instanceof AlreadyRecordedError) {
        useCaptureStore.getState().setStatus(item.key, 'recorded');
      } else {
        hapticError();
        Alert.alert("Couldn't save", errorMessage(err));
      }
    } finally {
      setBusy(null);
    }
  };

  const skip = (item: InboxItem) => useCaptureStore.getState().setStatus(item.key, 'ignored');

  const undo = async (item: InboxItem) => {
    if (item.status === 'recorded' || !item.savedAs) {
      useCaptureStore.getState().setStatus(item.key, 'pending');
      return;
    }
    setBusy(item.key);
    try {
      await unsaveCaptured(item.savedAs, qc);
      useCaptureStore.getState().setStatus(item.key, 'pending');
    } catch (err) {
      Alert.alert("Couldn't undo", errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const open = (item: InboxItem) => router.push({ pathname: '/capture/[key]', params: { key: item.key } });

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={captureSupported ? refresh : undefined}
      header={
        <Header
          title="Payments inbox"
          subtitle="From your bank SMS & UPI apps"
          right={
            <Pressable accessibilityRole="button" accessibilityLabel="Capture settings" onPress={() => router.push('/more/capture')} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.colors.surface2 }]}>
              <Settings2 size={18} color={t.colors.text} />
            </Pressable>
          }
        />
      }
    >
      {!captureSupported ? (
        <Card>
          <EmptyState emoji="📲" title="Install the latest Kanakku app" body="Reading bank SMS and GPay notifications needs the Android app (version with Payments inbox)." compact />
        </Card>
      ) : (
        <>
          {!setUp ? (
            <Card style={{ marginBottom: 14 }}>
              <Text variant="h2">Add payments without typing</Text>
              <Text tone="muted" style={{ marginTop: 4, marginBottom: 12 }}>
                Allow bank SMS and/or UPI app notifications. Kanakku finds each payment, you choose Personal, Group or Settle up — one tap.
              </Text>
              <Button title="Turn on" onPress={() => router.push('/more/capture')} />
            </Card>
          ) : null}

          <View style={styles.privacy}>
            <ShieldCheck size={14} color={t.colors.positive} />
            <Text variant="micro" tone="muted" style={{ flex: 1 }}>
              Messages are read on this phone only. Only payments you save go to Kanakku.
            </Text>
          </View>

          {pending.length === 0 ? (
            <Card>
              <EmptyState
                emoji={setUp ? '✅' : '💸'}
                title={setUp ? 'All sorted' : 'Nothing here yet'}
                body={setUp ? 'New payments appear here as they happen. Pull down to check now.' : 'Turn on capture to see your UPI and card payments here.'}
                compact
              />
            </Card>
          ) : (
            <>
              <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
                TO SORT · {pending.length}
              </Text>
              {groupByDay(pending, (i) => i.date).map((d) => (
                <View key={d.day} style={{ marginBottom: 12 }}>
                  <Text variant="small" tone="muted" weight="medium" style={{ marginBottom: 6, marginLeft: 4 }}>
                    {formatDayHeading(d.day)}
                  </Text>
                  <Card padded={false} style={{ overflow: 'hidden' }}>
                    {d.items.map((item, idx) => {
                      const s = suggestFor(item, ctx);
                      return (
                        <View key={item.key}>
                          {idx > 0 ? <Divider inset={60} /> : null}
                          <PendingRow
                            item={item}
                            suggestion={s}
                            groups={ctx.groups}
                            meId={meId}
                            currency={currency}
                            busy={busy === item.key}
                            onOpen={() => open(item)}
                            onSave={() => quickSave(item, s)}
                            onSkip={() => skip(item)}
                          />
                        </View>
                      );
                    })}
                  </Card>
                </View>
              ))}
            </>
          )}

          {done.length > 0 ? (
            <>
              <Text variant="micro" tone="muted" weight="semibold" style={[styles.caps, { marginTop: 8 }]}>
                SAVED THIS WEEK
              </Text>
              <Card padded={false} style={{ overflow: 'hidden', marginBottom: 12 }}>
                {done.slice(0, 30).map((item, idx) => (
                  <View key={item.key}>
                    {idx > 0 ? <Divider inset={60} /> : null}
                    <DoneRow item={item} groups={ctx.groups} currency={currency} busy={busy === item.key} onUndo={() => undo(item)} />
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {skipped.length > 0 ? (
            <>
              <Pressable accessibilityRole="button" onPress={() => setShowSkipped((v) => !v)} style={styles.skippedToggle}>
                <Text variant="small" tone="muted" weight="medium">
                  Skipped · {skipped.length}
                </Text>
                {showSkipped ? <ChevronUp size={16} color={t.colors.muted} /> : <ChevronDown size={16} color={t.colors.muted} />}
              </Pressable>
              {showSkipped ? (
                <Card padded={false} style={{ overflow: 'hidden', marginBottom: 12 }}>
                  {skipped.slice(0, 50).map((item, idx) => (
                    <View key={item.key}>
                      {idx > 0 ? <Divider inset={60} /> : null}
                      <Pressable accessibilityRole="button" onPress={() => useCaptureStore.getState().setStatus(item.key, 'pending')} style={styles.row}>
                        <DirIcon direction={item.direction} />
                        <View style={{ flex: 1 }}>
                          <Text weight="medium" numberOfLines={1}>
                            {displayName(item) ?? 'Unknown'}
                          </Text>
                          <Text variant="micro" tone="muted">
                            {formatDayHeading(item.date)} · tap to sort again
                          </Text>
                        </View>
                        <Money tone="muted">{formatMoney(item.amount, currency)}</Money>
                      </Pressable>
                    </View>
                  ))}
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function PendingRow({
  item,
  suggestion,
  groups,
  meId,
  currency,
  busy,
  onOpen,
  onSave,
  onSkip,
}: {
  item: InboxItem;
  suggestion: Suggestion;
  groups: Group[];
  meId: string;
  currency: string;
  busy: boolean;
  onOpen: () => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  const t = useTheme();
  const name = displayName(item);
  const isSkip = suggestion.kind === 'ignore';
  const cat = suggestion.kind === 'personal' || suggestion.kind === 'group' ? categoryMeta(suggestion.category) : null;
  return (
    <View>
      <Pressable accessibilityRole="button" onPress={onOpen} style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.colors.surface2 }]}>
        <DirIcon direction={item.direction} />
        <View style={{ flex: 1 }}>
          <Text weight="semibold" numberOfLines={1}>
            {name ?? (item.direction === 'debit' ? 'Payee not found' : 'Sender not found')}
          </Text>
          <Text variant="micro" tone="muted" numberOfLines={1}>
            {sourceLabel(item)} · {timeLabel(item.timestamp)}
            {item.confidence === 'low' ? ' · tap to fix' : ''}
          </Text>
        </View>
        <Money tone={item.direction === 'debit' ? 'text' : 'positive'}>
          {item.direction === 'debit' ? '−' : '+'}
          {formatMoney(item.amount, currency)}
        </Money>
      </Pressable>
      <View style={styles.suggestRow}>
        <Pressable accessibilityRole="button" onPress={onOpen} style={[styles.suggestion, { backgroundColor: t.colors.surface2, borderRadius: t.radii.pill }]}>
          <Text variant="micro" weight="medium" numberOfLines={1}>
            {cat ? `${cat.emoji} ` : ''}
            {describeSuggestion(suggestion, groups, meId)}
            {suggestion.rule ? ' · your rule' : ''}
          </Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {isSkip ? (
          <>
            <Button title="Sort" size="sm" variant="ghost" onPress={onOpen} />
            <Button title="Skip" size="sm" variant="secondary" onPress={onSkip} />
          </>
        ) : (
          <>
            <Button title="Skip" size="sm" variant="ghost" onPress={onSkip} disabled={busy} />
            <Button title="Save" size="sm" icon={<Check size={14} color={t.colors.onAccent} />} onPress={onSave} loading={busy} />
          </>
        )}
      </View>
    </View>
  );
}

function DoneRow({ item, groups, currency, busy, onUndo }: { item: InboxItem; groups: Group[]; currency: string; busy: boolean; onUndo: () => void }) {
  const g = item.savedAs?.groupId ? groups.find((x) => x.id === item.savedAs?.groupId) : undefined;
  const where =
    item.status === 'recorded'
      ? 'Already in Kanakku'
      : item.savedAs?.kind === 'personal'
        ? 'Saved to Personal'
        : item.savedAs?.kind === 'settlement'
          ? `Settle up · ${g?.name ?? 'group'}`
          : `Split in ${g?.name ?? 'group'}`;
  return (
    <View style={styles.row}>
      <DirIcon direction={item.direction} />
      <View style={{ flex: 1 }}>
        <Text weight="medium" numberOfLines={1}>
          {displayName(item) ?? 'Payment'}
        </Text>
        <Text variant="micro" tone="muted" numberOfLines={1}>
          {where}
          {item.savedAs?.auto ? ' · automatic' : ''}
        </Text>
      </View>
      <Money tone="muted">{formatMoney(item.amount, currency)}</Money>
      {item.status === 'saved' ? <Button title="Undo" size="sm" variant="ghost" onPress={onUndo} loading={busy} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, marginHorizontal: 4 },
  caps: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 60, paddingRight: 10, paddingBottom: 10, marginTop: -4 },
  suggestion: { paddingHorizontal: 10, paddingVertical: 5, flexShrink: 1, maxWidth: '55%' },
  skippedToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, marginLeft: 4, marginBottom: 6 },
});
