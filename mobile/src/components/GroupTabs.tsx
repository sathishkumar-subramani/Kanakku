import { useRouter } from 'expo-router';
import { ArrowRight, Copy, Search, Share2, Trash2, UserPlus, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import { CheckCircle2 } from 'lucide-react-native';

import { ApiError, errorMessage } from '@/api';
import {
  useActivity,
  useAddMember,
  useBalances,
  useDeleteSettlement,
  useGroupExpenses,
  useLookupUser,
  useRemoveMember,
  useSettlements,
} from '@/api/queries';
import type { Activity, Category, Group, Settlement } from '@/api/types';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card, Divider } from '@/components/Card';
import { CategoryChips } from '@/components/Chip';
import { Input } from '@/components/Input';
import { DayHeading, ExpenseRow } from '@/components/ListItems';
import { MonthPicker } from '@/components/MonthPicker';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { Money, Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { currentMonth, formatDay, formatRelative, groupByDay } from '@/utils/dates';
import { firstName, hapticError, hapticSuccess, isValidEmail } from '@/utils/misc';
import { describeBalance, formatMoney } from '@/utils/money';

// ---------------- Expenses ----------------

export function ExpensesTab({ group, meId }: { group: Group; meId?: string }) {
  const t = useTheme();
  const router = useRouter();
  const [month, setMonth] = useState<string | null>(currentMonth());
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(h);
  }, [search]);

  const q = useGroupExpenses(group.id, {
    month: month ?? undefined,
    search: debounced || undefined,
    category: category ?? undefined,
    pageSize: 100,
  });
  const items = q.data?.items ?? [];
  const days = useMemo(() => groupByDay(items, (e) => e.date), [items]);
  const total = items.reduce((s, e) => s + e.amount, 0);

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search expenses"
            left={<Search size={16} color={t.colors.muted} />}
            right={
              search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                  <X size={16} color={t.colors.muted} />
                </Pressable>
              ) : undefined
            }
            returnKeyType="search"
          />
        </View>
      </View>
      <View style={styles.monthFilterRow}>
        {month ? (
          <MonthPicker value={month} onChange={setMonth} compact />
        ) : (
          <Text variant="label" tone="muted">
            All time
          </Text>
        )}
        <Pressable onPress={() => setMonth(month ? null : currentMonth())} hitSlop={8}>
          <Text variant="small" tone="accent" weight="medium">
            {month ? 'Show all' : 'This month'}
          </Text>
        </Pressable>
      </View>
      <CategoryChips value={category} onChange={setCategory} includeAll />

      {q.isError ? (
        <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Card>
          <SkeletonRows rows={5} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🧾"
            title={debounced || category ? 'No matches' : 'No expenses yet'}
            body={debounced || category ? 'Try a different search or category.' : 'Add the first one and split it with the group.'}
            actionTitle={debounced || category ? undefined : 'Add expense'}
            onAction={() => router.push({ pathname: '/expense/new', params: { groupId: group.id } })}
            compact
          />
        </Card>
      ) : (
        <Card padded={false} style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
          <View style={styles.totalRow}>
            <Text variant="small" tone="muted">
              {items.length} expense{items.length === 1 ? '' : 's'}
            </Text>
            <Money variant="small" tone="muted">
              {formatMoney(total, group.currency)}
            </Money>
          </View>
          {days.map((d) => (
            <View key={d.day}>
              <DayHeading day={d.day} total={d.items.reduce((s, e) => s + e.amount, 0)} currency={group.currency} />
              {d.items.map((e, i) => (
                <React.Fragment key={e.id}>
                  {i > 0 ? <Divider inset={54} /> : null}
                  <ExpenseRow expense={e} meId={meId} currency={group.currency} onPress={() => router.push(`/expense/${e.id}`)} />
                </React.Fragment>
              ))}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

// ---------------- Balances ----------------

export function BalancesTab({ group, meId }: { group: Group; meId?: string }) {
  const t = useTheme();
  const router = useRouter();
  const balances = useBalances(group.id);
  const settlements = useSettlements(group.id);
  const del = useDeleteSettlement(group.id);

  const confirmDelete = (s: Settlement) => {
    Alert.alert('Delete this payment?', `${firstName(s.from.name)} → ${firstName(s.to.name)} · ${formatMoney(s.amount, group.currency)}`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          del
            .mutateAsync(s.id)
            .then(hapticSuccess)
            .catch((err: unknown) => {
              hapticError();
              Alert.alert("Couldn't delete", errorMessage(err));
            }),
      },
    ]);
  };

  if (balances.isError) return <ErrorState message={errorMessage(balances.error)} onRetry={() => balances.refetch()} />;
  if (balances.isLoading || !balances.data)
    return (
      <Card>
        <SkeletonRows rows={4} />
      </Card>
    );

  const b = balances.data;
  const allSettled = b.debts.length === 0;

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text variant="h2" style={{ marginBottom: 6 }}>
          Members
        </Text>
        {b.members.map((m, i) => {
          const isMe = m.userId === meId;
          const desc = describeBalance(m.balance, group.currency, isMe ? 'you' : 'they', firstName(m.name));
          return (
            <React.Fragment key={m.userId}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.memberRow}>
                <Avatar name={m.name} color={m.avatarColor} size={36} />
                <View style={{ flex: 1 }}>
                  <Text weight="medium">
                    {m.name}
                    {isMe ? ' (you)' : ''}
                  </Text>
                  <Text variant="micro" tone="muted">
                    paid {formatMoney(m.paid, group.currency)} · share {formatMoney(m.share, group.currency)}
                  </Text>
                </View>
                <Money variant="small" tone={desc.tone}>
                  {desc.tone === 'muted' ? 'settled up' : (desc.tone === 'positive' ? '+' : '−') + formatMoney(Math.abs(m.balance), group.currency)}
                </Money>
              </View>
            </React.Fragment>
          );
        })}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <Text variant="h2">Who pays whom</Text>
          <Text variant="micro" tone="muted">
            {b.simplified ? 'simplified' : 'pairwise'}
          </Text>
        </View>
        {allSettled ? (
          <SettledBadge />
        ) : (
          b.debts.map((d, i) => {
            const involvesMe = d.fromUserId === meId || d.toUserId === meId;
            return (
              <React.Fragment key={`${d.fromUserId}-${d.toUserId}`}>
                {i > 0 ? <Divider /> : null}
                <View style={styles.debtRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={styles.debtNames}>
                      <Text weight={involvesMe ? 'semibold' : 'regular'} numberOfLines={1}>
                        {d.fromUserId === meId ? 'You' : firstName(d.fromName)}
                      </Text>
                      <ArrowRight size={14} color={t.colors.muted} />
                      <Text weight={involvesMe ? 'semibold' : 'regular'} numberOfLines={1}>
                        {d.toUserId === meId ? 'you' : firstName(d.toName)}
                      </Text>
                    </View>
                    <Money variant="small" tone={d.fromUserId === meId ? 'negative' : d.toUserId === meId ? 'positive' : 'muted'}>
                      {formatMoney(d.amount, group.currency)}
                    </Money>
                  </View>
                  <Button
                    title="Settle"
                    size="sm"
                    variant={involvesMe ? 'primary' : 'secondary'}
                    onPress={() =>
                      router.push({
                        pathname: '/group/[id]/settle',
                        params: { id: group.id, from: d.fromUserId, to: d.toUserId, amount: String(d.amount) },
                      })
                    }
                  />
                </View>
              </React.Fragment>
            );
          })
        )}
      </Card>

      <Card>
        <Text variant="h2" style={{ marginBottom: 6 }}>
          Payments recorded
        </Text>
        {settlements.isLoading ? (
          <SkeletonRows rows={2} />
        ) : !settlements.data || settlements.data.length === 0 ? (
          <Text tone="muted" variant="small">
            No payments yet. When someone pays back, record it with Settle up.
          </Text>
        ) : (
          settlements.data.map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.settlementRow}>
                <Avatar name={s.from.name} color={s.from.avatarColor} size={30} />
                <ArrowRight size={14} color={t.colors.muted} />
                <Avatar name={s.to.name} color={s.to.avatarColor} size={30} />
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text variant="small" weight="medium" numberOfLines={1}>
                    {firstName(s.from.name)} paid {firstName(s.to.name)}
                  </Text>
                  <Text variant="micro" tone="muted" numberOfLines={1}>
                    {formatDay(s.date)}
                    {s.note ? ` · ${s.note}` : ''}
                  </Text>
                </View>
                <Money variant="small">{formatMoney(s.amount, group.currency)}</Money>
                <Pressable onPress={() => confirmDelete(s)} hitSlop={8} accessibilityLabel="Delete payment" style={{ marginLeft: 6 }}>
                  <Trash2 size={16} color={t.colors.muted} />
                </Pressable>
              </View>
            </React.Fragment>
          ))
        )}
      </Card>
    </View>
  );
}

/** The one "delight" moment: check-mark pop when the group is fully settled. */
export function SettledBadge({ compact }: { compact?: boolean }) {
  const t = useTheme();
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 200 });
    scale.value = withSequence(withSpring(1.15, { damping: 8 }), withSpring(1, { damping: 12 }));
  }, [opacity, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <View style={[styles.settled, compact && { paddingVertical: 10 }]}>
      <Animated.View style={anim}>
        <CheckCircle2 size={compact ? 28 : 40} color={t.colors.positive} />
      </Animated.View>
      <Text variant={compact ? 'small' : 'body'} tone="positive" weight="semibold">
        All settled up
      </Text>
    </View>
  );
}

// ---------------- Activity ----------------

const ACTIVITY_ICON: Record<Activity['type'], string> = {
  'expense.added': '🧾',
  'expense.updated': '✏️',
  'expense.deleted': '🗑️',
  'settlement.added': '🤝',
  'settlement.deleted': '↩️',
  'member.joined': '👋',
  'member.left': '🚪',
  'group.updated': '⚙️',
};

export function ActivityTab({ group }: { group: Group }) {
  const t = useTheme();
  const act = useActivity(group.id);
  if (act.isError) return <ErrorState message={errorMessage(act.error)} onRetry={() => act.refetch()} />;
  if (act.isLoading)
    return (
      <Card>
        <SkeletonRows rows={6} />
      </Card>
    );
  const items = act.data ?? [];
  if (items.length === 0)
    return (
      <Card>
        <EmptyState emoji="🕰️" title="Nothing has happened yet" body="Expenses, payments and member changes show up here." compact />
      </Card>
    );
  return (
    <Card padded={false} style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
      {items.map((a, i) => (
        <React.Fragment key={a.id}>
          {i > 0 ? <Divider inset={44} /> : null}
          <View style={styles.activityRow}>
            <View style={[styles.activityIcon, { backgroundColor: t.colors.surface2 }]}>
              <Text style={{ fontSize: 15, lineHeight: 20 }}>{ACTIVITY_ICON[a.type] ?? '•'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="small">{a.message}</Text>
              <Text variant="micro" tone="muted">
                {a.actorName} · {formatRelative(a.createdAt)}
              </Text>
            </View>
          </View>
        </React.Fragment>
      ))}
    </Card>
  );
}

// ---------------- Members ----------------

export function MembersTab({ group, meId }: { group: Group; meId?: string }) {
  const t = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const lookup = useLookupUser(email);
  const add = useAddMember(group.id);
  const remove = useRemoveMember(group.id);
  const isOwner = group.members.some((m) => m.userId === meId && m.role === 'owner');

  const copyCode = async () => {
    await Clipboard.setStringAsync(group.inviteCode);
    hapticSuccess();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shareCode = () => {
    Share.share({
      message: `Join "${group.name}" on Kanakku with invite code ${group.inviteCode}`,
    }).catch(() => undefined);
  };

  const addMember = async () => {
    try {
      await add.mutateAsync(email);
      hapticSuccess();
      setEmail('');
    } catch (err) {
      hapticError();
      const e = err instanceof ApiError ? err : null;
      Alert.alert("Couldn't add member", e?.status === 404 ? 'No Kanakku account uses that email yet. Ask them to sign up first.' : e?.status === 409 ? "They're already in this group." : errorMessage(err));
    }
  };

  const confirmRemove = (userId: string, name: string) => {
    const isMe = userId === meId;
    Alert.alert(isMe ? 'Leave this group?' : `Remove ${firstName(name)}?`, isMe ? 'You can rejoin later with the invite code.' : 'They will lose access to this ledger.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isMe ? 'Leave' : 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(userId);
            hapticSuccess();
            if (isMe) router.replace('/(tabs)/groups');
          } catch (err) {
            hapticError();
            const e = err instanceof ApiError ? err : null;
            Alert.alert(
              isMe ? "Can't leave yet" : "Can't remove yet",
              e?.status === 409
                ? `${isMe ? 'Your' : `${firstName(name)}'s`} balance isn't settled. Settle up first, then try again.`
                : errorMessage(err),
            );
          }
        },
      },
    ]);
  };

  const canAdd = isValidEmail(email) && !!lookup.data && !add.isPending;

  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Text variant="h2">Invite code</Text>
        <Text variant="small" tone="muted" style={{ marginTop: 2 }}>
          Anyone with this code can join from Groups → Join with code.
        </Text>
        <View style={[styles.codeBox, { backgroundColor: t.colors.surface2, borderColor: t.colors.border }]}>
          <Money variant="h1" style={{ letterSpacing: 4 }}>
            {group.inviteCode}
          </Money>
        </View>
        <View style={styles.codeActions}>
          <Button title={copied ? 'Copied' : 'Copy'} variant="secondary" size="sm" icon={<Copy size={16} color={t.colors.text} />} onPress={copyCode} style={{ flex: 1 }} />
          <Button title="Share" variant="secondary" size="sm" icon={<Share2 size={16} color={t.colors.text} />} onPress={shareCode} style={{ flex: 1 }} />
        </View>
      </Card>

      <Card>
        <Text variant="h2" style={{ marginBottom: 8 }}>
          Add by email
        </Text>
        <Input
          value={email}
          onChangeText={setEmail}
          placeholder="friend@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          left={<UserPlus size={16} color={t.colors.muted} />}
          hint={
            isValidEmail(email)
              ? lookup.isFetching
                ? 'Looking up…'
                : lookup.data
                  ? `Found ${lookup.data.name}`
                  : lookup.isError
                    ? 'No account with that email yet.'
                    : undefined
              : undefined
          }
        />
        {lookup.data ? (
          <View style={styles.lookupRow}>
            <Avatar name={lookup.data.name} color={lookup.data.avatarColor} size={32} />
            <View style={{ flex: 1 }}>
              <Text weight="medium">{lookup.data.name}</Text>
              <Text variant="micro" tone="muted">
                {lookup.data.email}
              </Text>
            </View>
            <Button title="Add" size="sm" onPress={addMember} disabled={!canAdd} loading={add.isPending} />
          </View>
        ) : null}
      </Card>

      <Card>
        <Text variant="h2" style={{ marginBottom: 4 }}>
          {group.members.length} member{group.members.length === 1 ? '' : 's'}
        </Text>
        {group.members.map((m, i) => {
          const isMe = m.userId === meId;
          const canRemove = isMe || (isOwner && m.role !== 'owner');
          return (
            <React.Fragment key={m.userId}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.memberRow}>
                <Avatar name={m.name} color={m.avatarColor} size={36} />
                <View style={{ flex: 1 }}>
                  <Text weight="medium">
                    {m.name}
                    {isMe ? ' (you)' : ''}
                  </Text>
                  <Text variant="micro" tone="muted" numberOfLines={1}>
                    {m.role === 'owner' ? 'Owner · ' : ''}
                    {m.email}
                  </Text>
                </View>
                {canRemove ? (
                  <Pressable onPress={() => confirmRemove(m.userId, m.name)} hitSlop={8} accessibilityLabel={isMe ? 'Leave group' : `Remove ${m.name}`}>
                    <Text variant="small" tone={isMe ? 'negative' : 'muted'} weight="medium">
                      {isMe ? 'Leave' : 'Remove'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </React.Fragment>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  monthFilterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  debtNames: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settlementRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10 },
  settled: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  activityIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeBox: { marginTop: 12, borderWidth: 1, borderRadius: 12, alignItems: 'center', paddingVertical: 14 },
  codeActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  lookupRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
});
