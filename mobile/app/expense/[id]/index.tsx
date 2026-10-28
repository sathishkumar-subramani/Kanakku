import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useDeleteExpense, useExpense, useMe } from '@/api/queries';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { CategoryIcon, KeyValueRow } from '@/components/ListItems';
import { Header, Screen } from '@/components/Screen';
import { ErrorState, SkeletonRows } from '@/components/States';
import { Money, Text } from '@/components/Text';
import { categoryMeta } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDay, formatRelative } from '@/utils/dates';
import { firstName, hapticError, hapticSuccess } from '@/utils/misc';
import { formatMoney } from '@/utils/money';

export default function ExpenseDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exp = useExpense(id);
  const me = useMe();
  const e = exp.data;
  const del = useDeleteExpense(e?.groupId ?? '');
  const meId = me.data?.id;

  const confirmDelete = () => {
    if (!e) return;
    Alert.alert('Delete this expense?', `"${e.description}" will be removed for everyone in ${e.groupName}.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(e.id);
            hapticSuccess();
            router.back();
          } catch (err) {
            hapticError();
            Alert.alert("Couldn't delete", errorMessage(err));
          }
        },
      },
    ]);
  };

  const paidByMe = !!e && e.paidBy.id === meId;
  const splitLabel = e ? ({ equal: 'Split equally', exact: 'Exact amounts', percent: 'By percentage', shares: 'By shares' } as const)[e.splitType] : '';

  return (
    <Screen
      header={
        <Header
          title="Expense"
          subtitle={e ? `${e.groupEmoji} ${e.groupName}` : undefined}
          right={
            e ? (
              <>
                <Pressable accessibilityRole="button" accessibilityLabel="Edit" onPress={() => router.push(`/expense/${e.id}/edit`)} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.colors.surface2 }]}>
                  <Pencil size={17} color={t.colors.text} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Delete" onPress={confirmDelete} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.colors.negativeSoft }]}>
                  <Trash2 size={17} color={t.colors.negative} />
                </Pressable>
              </>
            ) : undefined
          }
        />
      }
    >
      {exp.isError ? (
        <ErrorState message={errorMessage(exp.error)} onRetry={() => exp.refetch()} />
      ) : !e ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          <Card style={styles.hero}>
            <CategoryIcon category={e.category} size={56} />
            <Text variant="h1" center style={{ marginTop: 10 }}>
              {e.description}
            </Text>
            <Money variant="display">{formatMoney(e.amount, e.currency)}</Money>
            <Text variant="small" tone="muted">
              {categoryMeta(e.category).label} · {formatDay(e.date, { weekday: true, year: true })}
            </Text>
            {e.myShare > 0 || paidByMe ? (
              <View style={[styles.sharePill, { backgroundColor: paidByMe ? t.colors.positiveSoft : t.colors.negativeSoft }]}>
                <Text variant="small" weight="semibold" tone={paidByMe ? 'positive' : 'negative'}>
                  {paidByMe
                    ? e.amount - e.myShare > 0.004
                      ? `You paid · you lent ${formatMoney(e.amount - e.myShare, e.currency)}`
                      : 'You paid for yourself'
                    : `Your share ${formatMoney(e.myShare, e.currency)}`}
                </Text>
              </View>
            ) : null}
          </Card>

          <Card>
            <View style={styles.paidRow}>
              <Avatar name={e.paidBy.name} color={e.paidBy.avatarColor} size={36} />
              <View style={{ flex: 1 }}>
                <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
                  PAID BY
                </Text>
                <Text weight="medium">{paidByMe ? 'You' : e.paidBy.name}</Text>
              </View>
              <Money>{formatMoney(e.amount, e.currency)}</Money>
            </View>
          </Card>

          <Card>
            <View style={styles.rowBetween}>
              <Text variant="h2">Split</Text>
              <Text variant="micro" tone="muted">
                {splitLabel}
              </Text>
            </View>
            {e.splits.map((s, i) => (
              <React.Fragment key={s.userId}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.splitRow}>
                  <Avatar name={s.name} color={s.avatarColor} size={30} />
                  <Text style={{ flex: 1 }} weight={s.userId === meId ? 'semibold' : 'regular'}>
                    {s.userId === meId ? 'You' : s.name}
                  </Text>
                  {e.splitType === 'percent' ? (
                    <Text variant="micro" tone="muted" style={{ marginRight: 8 }}>
                      {s.value}%
                    </Text>
                  ) : e.splitType === 'shares' ? (
                    <Text variant="micro" tone="muted" style={{ marginRight: 8 }}>
                      {s.value} sh
                    </Text>
                  ) : null}
                  <Money variant="small">{formatMoney(s.amount, e.currency)}</Money>
                </View>
              </React.Fragment>
            ))}
          </Card>

          {e.notes ? (
            <Card>
              <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
                NOTES
              </Text>
              <Text style={{ marginTop: 4 }}>{e.notes}</Text>
            </Card>
          ) : null}

          <Card>
            <KeyValueRow label="Added" value={formatRelative(e.createdAt)} />
            {e.updatedAt !== e.createdAt ? <KeyValueRow label="Last edited" value={formatRelative(e.updatedAt)} /> : null}
            <KeyValueRow label="Paid by" value={firstName(e.paidBy.name)} />
          </Card>

          <Button title="Edit expense" variant="secondary" onPress={() => router.push(`/expense/${e.id}/edit`)} fullWidth />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 22 },
  sharePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 6 },
  paidRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  caps: { letterSpacing: 0.6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
});
