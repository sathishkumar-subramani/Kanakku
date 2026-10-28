import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Wallet } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useGroups, useMe } from '@/api/queries';
import { EmojiBadge } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ExpenseForm } from '@/components/ExpenseForm';
import { Header, Screen } from '@/components/Screen';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { pluralize } from '@/utils/misc';

/**
 * Add expense. If `groupId` is passed we go straight to the form; otherwise the user picks
 * a group (or Personal). With exactly one group and no personal entries we still show the
 * chooser so Personal stays reachable, but preselect the group.
 */
export default function NewExpenseScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const groups = useGroups();
  const me = useMe();
  const [groupId, setGroupId] = useState<string | null>(params.groupId ?? null);

  useEffect(() => {
    if (params.groupId) setGroupId(params.groupId);
  }, [params.groupId]);

  const list = groups.data ?? [];
  const selected = groupId ? list.find((g) => g.id === groupId) : undefined;

  if (selected && me.data) {
    return (
      <Screen
        keyboard
        header={
          <Header
            title="Add expense"
            subtitle={`${selected.emoji} ${selected.name}`}
            onBack={params.groupId ? undefined : () => setGroupId(null)}
            right={
              params.groupId ? undefined : (
                <Pressable onPress={() => setGroupId(null)} hitSlop={8}>
                  <Text variant="small" tone="accent" weight="medium">
                    Change
                  </Text>
                </Pressable>
              )
            }
          />
        }
      >
        <ExpenseForm group={selected} meId={me.data.id} />
      </Screen>
    );
  }

  return (
    <Screen header={<Header title="Add expense" subtitle="Where does this one belong?" />}>
      {groups.isError ? (
        <ErrorState message={errorMessage(groups.error)} onRetry={() => groups.refetch()} />
      ) : groups.isLoading || !me.data ? (
        <Card>
          <SkeletonRows rows={3} />
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          <Card padded={false}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/personal/new')}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: t.colors.surface2 }]}
            >
              <View style={[styles.personalIcon, { backgroundColor: t.colors.accentSoft }]}>
                <Wallet size={22} color={t.colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="h2">Personal</Text>
                <Text variant="small" tone="muted">
                  Just for you, not shared with anyone.
                </Text>
              </View>
              <ChevronRight size={18} color={t.colors.muted} />
            </Pressable>
          </Card>

          {list.length === 0 ? (
            <Card>
              <EmptyState emoji="🏠" title="No groups yet" body="Create a group to split expenses with others." actionTitle="New group" onAction={() => router.replace('/group/new')} compact />
            </Card>
          ) : (
            <Card padded={false}>
              {list.map((g, i) => (
                <Pressable
                  key={g.id}
                  accessibilityRole="button"
                  onPress={() => setGroupId(g.id)}
                  style={({ pressed }) => [
                    styles.option,
                    i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border },
                    pressed && { backgroundColor: t.colors.surface2 },
                  ]}
                >
                  <EmojiBadge emoji={g.emoji || '🏠'} color={g.color || t.colors.accent} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text variant="h2" numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text variant="small" tone="muted">
                      {pluralize(g.members.length, 'member')}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={t.colors.muted} />
                </Pressable>
              ))}
            </Card>
          )}
          <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  personalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
