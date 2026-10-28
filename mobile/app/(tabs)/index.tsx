import { useRouter } from 'expo-router';
import { FileDown } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useDashboard, useMe } from '@/api/queries';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card, Divider, SectionTitle } from '@/components/Card';
import { CategoryDonut, DailyBars, GroupBars } from '@/components/Charts';
import { ExpenseRow } from '@/components/ListItems';
import { MonthPicker } from '@/components/MonthPicker';
import { PageTitle, Screen } from '@/components/Screen';
import { StatTile } from '@/components/StatTile';
import { EmptyState, ErrorState, Skeleton, SkeletonRows, WakingUpHint } from '@/components/States';
import { Money, Text } from '@/components/Text';
import { useDownloadReport } from '@/hooks/useDownloadReport';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { currentMonth, formatMonthLabel } from '@/utils/dates';
import { firstName } from '@/utils/misc';
import { describeBalance, formatMoney } from '@/utils/money';

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const me = useMe();
  const user = useAuthStore((s) => s.user) ?? me.data ?? null;
  const wakingUp = useAuthStore((s) => s.wakingUp);
  const currency = user?.currency ?? 'INR';
  const dash = useDashboard(month);
  const { download, isBusy } = useDownloadReport();

  const d = dash.data;
  const isThisMonth = month === currentMonth();
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const hasAnything = !!d && (d.totalSpent > 0 || d.recent.length > 0 || d.byGroup.length > 0);

  return (
    <Screen
      refreshing={dash.isRefetching && !dash.isLoading}
      onRefresh={() => {
        dash.refetch();
        me.refetch();
      }}
      header={
        <PageTitle
          title={user ? `${greeting}, ${firstName(user.name)}` : greeting}
          subtitle={isThisMonth ? 'Here is where this month stands.' : `Looking back at ${formatMonthLabel(month, true)}.`}
          right={user ? <Avatar name={user.name} color={user.avatarColor} size={40} /> : undefined}
        />
      }
    >
      <WakingUpHint visible={wakingUp && dash.isLoading} />
      <View style={styles.monthRow}>
        <MonthPicker value={month} onChange={setMonth} />
      </View>

      {dash.isError ? (
        <ErrorState message={errorMessage(dash.error)} onRetry={() => dash.refetch()} />
      ) : dash.isLoading || !d ? (
        <LoadingDashboard />
      ) : (
        <>
          <View style={styles.tiles}>
            <StatTile label="This month" value={d.totalSpent} currency={currency} trend={{ prev: d.prevMonthTotal }} hint={`vs ${formatMoney(d.prevMonthTotal, currency, { compact: true })} last month`} />
            <StatTile label="I paid" value={d.iPaid} currency={currency} hint="cash out of pocket" />
          </View>
          <View style={styles.tiles}>
            <StatTile label="You owe" value={d.youOwe} currency={currency} tone={d.youOwe > 0 ? 'negative' : 'text'} hint="across all groups" />
            <StatTile label="You are owed" value={d.youAreOwed} currency={currency} tone={d.youAreOwed > 0 ? 'positive' : 'text'} hint="across all groups" />
          </View>

          {d.groupBalances.length > 0 ? (
            <Card style={styles.card}>
              <View style={styles.netRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
                    NET BALANCE
                  </Text>
                  <Text variant="h2" tone={describeBalance(d.netBalance).tone === 'muted' ? 'text' : describeBalance(d.netBalance).tone}>
                    {capitalize(describeBalance(d.netBalance, currency).text)}
                  </Text>
                </View>
                <Button title="Groups" variant="secondary" size="sm" onPress={() => router.push('/(tabs)/groups')} />
              </View>
              <Divider />
              <View style={{ marginTop: 6 }}>
                {d.groupBalances.map((g) => {
                  const b = describeBalance(g.balance, currency);
                  return (
                    <View key={g.groupId} style={styles.gbRow}>
                      <Text numberOfLines={1} style={{ flex: 1 }}>
                        {g.emoji} {g.name}
                      </Text>
                      <Money variant="small" tone={b.tone}>
                        {b.text}
                      </Money>
                    </View>
                  );
                })}
              </View>
            </Card>
          ) : null}

          {!hasAnything ? (
            <Card style={styles.card}>
              <EmptyState
                emoji="🗒️"
                title={isThisMonth ? 'Nothing recorded yet this month' : `Nothing in ${formatMonthLabel(month)}`}
                body="Add an expense from the + button, or create a group and invite your flatmates."
                actionTitle="Add expense"
                onAction={() => router.push('/expense/new')}
                compact
              />
            </Card>
          ) : (
            <>
              {d.byGroup.length > 0 ? (
                <Card style={styles.card}>
                  <SectionTitle title="Spend by group" style={styles.cardTitle} />
                  <GroupBars data={d.byGroup} currency={currency} />
                </Card>
              ) : null}

              {d.byCategory.some((c) => c.amount > 0) ? (
                <Card style={styles.card}>
                  <SectionTitle title="By category" style={styles.cardTitle} />
                  <CategoryDonut data={d.byCategory} currency={currency} total={d.totalSpent} />
                </Card>
              ) : null}

              {d.daily.length > 0 ? (
                <Card style={styles.card}>
                  <SectionTitle
                    title="Daily spend"
                    style={styles.cardTitle}
                    right={
                      <Text variant="small" tone="muted">
                        avg {formatMoney(d.totalSpent / Math.max(1, d.daily.filter((x) => x.amount > 0).length), currency, { compact: true })}/day
                      </Text>
                    }
                  />
                  <DailyBars data={d.daily} currency={currency} />
                </Card>
              ) : null}

              {d.recent.length > 0 ? (
                <Card style={styles.card}>
                  <SectionTitle title="Recent" style={styles.cardTitle} />
                  {d.recent.map((e, i) => (
                    <React.Fragment key={e.id}>
                      {i > 0 ? <Divider inset={54} /> : null}
                      <ExpenseRow
                        expense={e}
                        meId={user?.id}
                        currency={currency}
                        showGroup
                        onPress={() => (e.groupId === 'personal' ? router.push(`/personal/${e.id}`) : router.push(`/expense/${e.id}`))}
                      />
                    </React.Fragment>
                  ))}
                </Card>
              ) : null}
            </>
          )}

          <Button
            title={`Download PDF · ${formatMonthLabel(month)}`}
            variant="secondary"
            icon={<FileDown size={18} color={t.colors.text} />}
            onPress={() => download(month, 'pdf')}
            loading={isBusy(month, 'pdf')}
            fullWidth
            style={{ marginTop: 4 }}
          />
          <Text variant="micro" tone="muted" center style={{ marginTop: 8 }}>
            Everything this month: groups and personal, with balances.
          </Text>
        </>
      )}
    </Screen>
  );
}

function LoadingDashboard() {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.tiles}>
        <Card style={styles.tile}>
          <Skeleton width="50%" height={10} />
          <Skeleton width="70%" height={20} />
        </Card>
        <Card style={styles.tile}>
          <Skeleton width="50%" height={10} />
          <Skeleton width="70%" height={20} />
        </Card>
      </View>
      <View style={styles.tiles}>
        <Card style={styles.tile}>
          <Skeleton width="50%" height={10} />
          <Skeleton width="70%" height={20} />
        </Card>
        <Card style={styles.tile}>
          <Skeleton width="50%" height={10} />
          <Skeleton width="70%" height={20} />
        </Card>
      </View>
      <Card>
        <Skeleton width="40%" height={16} style={{ marginBottom: 14 }} />
        <SkeletonRows rows={3} />
      </Card>
    </View>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  monthRow: { marginBottom: 14, marginTop: 4 },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tile: { flex: 1, gap: 10, paddingVertical: 14 },
  card: { marginBottom: 12 },
  cardTitle: { marginTop: 0 },
  caps: { letterSpacing: 0.6, marginBottom: 2 },
  netRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  gbRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
});
