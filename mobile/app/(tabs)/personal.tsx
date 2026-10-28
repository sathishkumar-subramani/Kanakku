import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useMe, usePersonal } from '@/api/queries';
import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { DayHeading, PersonalRow } from '@/components/ListItems';
import { MonthPicker } from '@/components/MonthPicker';
import { PageTitle, Screen } from '@/components/Screen';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { Money, Text } from '@/components/Text';
import { categoryMeta } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { currentMonth, formatMonthLabel, groupByDay } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

export default function PersonalScreen() {
  const t = useTheme();
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const me = useMe();
  const currency = me.data?.currency ?? 'INR';
  const q = usePersonal(month);
  const items = q.data ?? [];
  const total = items.reduce((s, e) => s + e.amount, 0);
  const days = useMemo(() => groupByDay(items, (e) => e.date), [items]);
  const topCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of items) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
    let best: { c: string; v: number } | null = null;
    for (const [c, v] of map) if (!best || v > best.v) best = { c, v };
    return best;
  }, [items]);

  return (
    <Screen
      refreshing={q.isRefetching && !q.isLoading}
      onRefresh={() => q.refetch()}
      header={
        <PageTitle
          title="Personal"
          subtitle="Spending that's only yours."
          right={<Button title="Add" size="sm" icon={<Plus size={16} color={t.colors.onAccent} />} onPress={() => router.push('/personal/new')} />}
        />
      }
    >
      <View style={styles.monthRow}>
        <MonthPicker value={month} onChange={setMonth} />
      </View>

      <Card style={styles.totalCard}>
        <View style={{ flex: 1 }}>
          <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
            {formatMonthLabel(month).toUpperCase()} TOTAL
          </Text>
          <Money variant="display">{formatMoney(total, currency)}</Money>
          <Text variant="small" tone="muted">
            {items.length} {items.length === 1 ? 'entry' : 'entries'}
            {topCategory ? ` · mostly ${categoryMeta(topCategory.c).emoji} ${categoryMeta(topCategory.c).label.toLowerCase()}` : ''}
          </Text>
        </View>
      </Card>

      {q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Card>
          <SkeletonRows rows={5} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🧘"
            title={month === currentMonth() ? 'Nothing personal yet this month' : `Nothing in ${formatMonthLabel(month)}`}
            body="Track coffee, commute and anything you don't split with others."
            actionTitle="Add expense"
            onAction={() => router.push('/personal/new')}
            compact
          />
        </Card>
      ) : (
        <Card padded={false} style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
          {days.map((d) => (
            <View key={d.day}>
              <DayHeading day={d.day} total={d.items.reduce((s, e) => s + e.amount, 0)} currency={currency} />
              {d.items.map((e, i) => (
                <React.Fragment key={e.id}>
                  {i > 0 ? <Divider inset={54} /> : null}
                  <PersonalRow item={e} currency={currency} onPress={() => router.push(`/personal/${e.id}`)} />
                </React.Fragment>
              ))}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { marginBottom: 14, marginTop: 4 },
  totalCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  caps: { letterSpacing: 0.6, marginBottom: 2 },
});
