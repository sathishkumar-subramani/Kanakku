import { useRouter } from 'expo-router';
import { KeyRound, Plus } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useGroups, useMe } from '@/api/queries';
import type { Group } from '@/api/types';
import { AvatarStack, EmojiBadge } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PageTitle, Screen } from '@/components/Screen';
import { EmptyState, ErrorState, Skeleton } from '@/components/States';
import { Money, Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { formatRelative } from '@/utils/dates';
import { pluralize } from '@/utils/misc';
import { describeBalance, formatMoney } from '@/utils/money';

export default function GroupsScreen() {
  const t = useTheme();
  const router = useRouter();
  const groups = useGroups();
  const me = useMe();
  const currency = me.data?.currency ?? 'INR';

  return (
    <Screen
      refreshing={groups.isRefetching && !groups.isLoading}
      onRefresh={() => groups.refetch()}
      header={<PageTitle title="Groups" subtitle="Flat, trips, office lunches — one ledger each." />}
    >
      <View style={styles.actions}>
        <Button title="New group" icon={<Plus size={18} color={t.colors.onAccent} />} onPress={() => router.push('/group/new')} style={{ flex: 1 }} />
        <Button title="Join with code" variant="secondary" icon={<KeyRound size={18} color={t.colors.text} />} onPress={() => router.push('/group/join')} style={{ flex: 1 }} />
      </View>

      {groups.isError ? (
        <ErrorState message={errorMessage(groups.error)} onRetry={() => groups.refetch()} />
      ) : groups.isLoading ? (
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Card key={i} style={styles.card}>
              <View style={styles.cardTop}>
                <Skeleton width={44} height={44} radius={14} />
                <View style={{ flex: 1, gap: 8 }}>
                  <Skeleton width="55%" height={16} />
                  <Skeleton width="35%" height={11} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : groups.data && groups.data.length > 0 ? (
        <View style={{ gap: 12 }}>
          {groups.data.map((g) => (
            <GroupCard key={g.id} group={g} currency={currency} onPress={() => router.push(`/group/${g.id}`)} />
          ))}
        </View>
      ) : (
        <Card>
          <EmptyState
            emoji="🏠"
            title="No groups yet"
            body="Create one for your flat or trip, or join with the code a friend shared."
            actionTitle="New group"
            onAction={() => router.push('/group/new')}
            compact
          />
        </Card>
      )}
    </Screen>
  );
}

function GroupCard({ group, currency, onPress }: { group: Group; currency: string; onPress: () => void }) {
  const t = useTheme();
  const b = describeBalance(group.myBalance, group.currency || currency);
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <EmojiBadge emoji={group.emoji || '🏠'} color={group.color || t.colors.accent} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h2" numberOfLines={1}>
            {group.name}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {pluralize(group.members.length, 'member')}
            {group.lastActivityAt ? ` · active ${formatRelative(group.lastActivityAt)}` : ''}
          </Text>
        </View>
        <AvatarStack people={group.members} size={26} max={3} />
      </View>
      <View style={[styles.cardBottom, { borderTopColor: t.colors.border }]}>
        <View style={{ flex: 1 }}>
          <Money variant="body" tone={b.tone}>
            {b.text}
          </Money>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Money variant="small">{formatMoney(group.monthSpent, group.currency || currency, { compact: true })}</Money>
          <Text variant="micro" tone="muted">
            this month
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: { gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingTop: 12 },
});
