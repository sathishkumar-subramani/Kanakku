import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, Settings2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useBalances, useGroup, useMe } from '@/api/queries';
import { AvatarStack, EmojiBadge } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Segmented } from '@/components/Chip';
import { ActivityTab, BalancesTab, ExpensesTab, MembersTab, SettledBadge } from '@/components/GroupTabs';
import { Header, Screen } from '@/components/Screen';
import { ErrorState, Skeleton } from '@/components/States';
import { Money, Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { pluralize } from '@/utils/misc';
import { describeBalance, formatMoney } from '@/utils/money';

type Tab = 'expenses' | 'balances' | 'activity' | 'members';

export default function GroupDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<Tab>((initialTab as Tab | undefined) ?? 'expenses');
  const group = useGroup(id);
  const me = useMe();
  const balances = useBalances(id);
  const g = group.data;
  const meId = me.data?.id;

  const isOwner = !!g && g.members.some((m) => m.userId === meId && m.role === 'owner');
  const bal = g ? describeBalance(g.myBalance, g.currency) : null;
  const allSettled = !!balances.data && balances.data.debts.length === 0 && (g?.totalSpent ?? 0) > 0;

  return (
    <Screen
      refreshing={group.isRefetching && !group.isLoading}
      onRefresh={() => {
        group.refetch();
        balances.refetch();
      }}
      header={
        <Header
          title={g ? `${g.emoji} ${g.name}` : 'Group'}
          subtitle={g ? `${pluralize(g.members.length, 'member')} · ${formatMoney(g.totalSpent, g.currency, { compact: true })} all time` : undefined}
          right={
            g ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isOwner ? 'Group settings' : 'Group info'}
                onPress={() => router.push(`/group/${g.id}/settings`)}
                hitSlop={8}
                style={[styles.iconBtn, { backgroundColor: t.colors.surface2 }]}
              >
                <Settings2 size={18} color={t.colors.text} />
              </Pressable>
            ) : undefined
          }
        />
      }
    >
      {group.isError ? (
        <ErrorState message={errorMessage(group.error)} onRetry={() => group.refetch()} />
      ) : !g ? (
        <Card>
          <Skeleton width="60%" height={20} />
          <Skeleton width="40%" height={12} style={{ marginTop: 10 }} />
        </Card>
      ) : (
        <>
          <Card style={styles.strip}>
            <View style={styles.stripTop}>
              <EmojiBadge emoji={g.emoji || '🏠'} color={g.color || t.colors.accent} size={48} />
              <View style={{ flex: 1 }}>
                <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
                  YOUR BALANCE
                </Text>
                {allSettled && bal?.tone === 'muted' ? (
                  <SettledBadge compact />
                ) : (
                  <Money variant="h1" tone={bal?.tone === 'muted' ? 'text' : bal?.tone}>
                    {bal ? capitalize(bal.text) : ''}
                  </Money>
                )}
              </View>
              <AvatarStack people={g.members} size={28} max={3} />
            </View>
            <View style={styles.stripActions}>
              <Button title="Add expense" icon={<Plus size={18} color={t.colors.onAccent} />} onPress={() => router.push({ pathname: '/expense/new', params: { groupId: g.id } })} style={{ flex: 1 }} />
              <Button title="Settle up" variant="secondary" onPress={() => router.push({ pathname: '/group/[id]/settle', params: { id: g.id } })} style={{ flex: 1 }} />
            </View>
            <View style={styles.stripStats}>
              <View style={{ flex: 1 }}>
                <Text variant="micro" tone="muted">
                  This month
                </Text>
                <Money variant="small">{formatMoney(g.monthSpent, g.currency)}</Money>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="micro" tone="muted">
                  All time
                </Text>
                <Money variant="small">{formatMoney(g.totalSpent, g.currency)}</Money>
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="micro" tone="muted">
                  Debts
                </Text>
                <Text variant="small" weight="medium">
                  {g.simplifyDebts ? 'Simplified' : 'Pairwise'}
                </Text>
              </View>
            </View>
          </Card>

          <View style={styles.tabs}>
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'expenses', label: 'Expenses' },
                { value: 'balances', label: 'Balances' },
                { value: 'activity', label: 'Activity' },
                { value: 'members', label: 'Members' },
              ]}
            />
          </View>

          {tab === 'expenses' ? <ExpensesTab group={g} meId={meId} /> : null}
          {tab === 'balances' ? <BalancesTab group={g} meId={meId} /> : null}
          {tab === 'activity' ? <ActivityTab group={g} /> : null}
          {tab === 'members' ? <MembersTab group={g} meId={meId} /> : null}
        </>
      )}
    </Screen>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  strip: { gap: 14, marginBottom: 14 },
  stripTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stripActions: { flexDirection: 'row', gap: 10 },
  stripStats: { flexDirection: 'row', gap: 10 },
  caps: { letterSpacing: 0.6, marginBottom: 2 },
  tabs: { marginBottom: 12 },
});
