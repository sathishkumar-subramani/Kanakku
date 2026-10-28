import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { errorMessage } from '@/api';
import { useDeleteGroup, useGroup, useMe, useRegenerateInvite, useUpdateGroup } from '@/api/queries';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ColorPicker, EmojiPicker } from '@/components/GroupForm';
import { Input } from '@/components/Input';
import { Header, Screen } from '@/components/Screen';
import { Skeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { hapticError, hapticSuccess } from '@/utils/misc';

export default function GroupSettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  const me = useMe();
  const update = useUpdateGroup(id);
  const regen = useRegenerateInvite(id);
  const del = useDeleteGroup();
  const g = group.data;
  const isOwner = !!g && g.members.some((m) => m.userId === me.data?.id && m.role === 'owner');

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [color, setColor] = useState('#E2590B');
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (g && !seeded) {
      setName(g.name);
      setEmoji(g.emoji);
      setColor(g.color);
      setSeeded(true);
    }
  }, [g, seeded]);

  const dirty = !!g && (name.trim() !== g.name || emoji !== g.emoji || color !== g.color);

  const save = async () => {
    if (!g) return;
    if (name.trim().length < 2) {
      Alert.alert('Name needed', 'Give the group a name.');
      return;
    }
    try {
      await update.mutateAsync({ name: name.trim(), emoji, color });
      hapticSuccess();
      router.back();
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save", errorMessage(err));
    }
  };

  const toggleSimplify = async (v: boolean) => {
    try {
      await update.mutateAsync({ simplifyDebts: v });
      hapticSuccess();
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't update", errorMessage(err));
    }
  };

  const regenerate = () => {
    Alert.alert('Regenerate invite code?', 'The old code stops working immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Regenerate',
        onPress: () =>
          regen
            .mutateAsync()
            .then(hapticSuccess)
            .catch((err: unknown) => {
              hapticError();
              Alert.alert("Couldn't regenerate", errorMessage(err));
            }),
      },
    ]);
  };

  const confirmDelete = () => {
    if (!g) return;
    Alert.alert(`Delete "${g.name}"?`, 'Every expense and payment in this group is deleted for everyone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete group',
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(g.id);
            hapticSuccess();
            router.replace('/(tabs)/groups');
          } catch (err) {
            hapticError();
            Alert.alert("Couldn't delete", errorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <Screen keyboard header={<Header title={isOwner ? 'Group settings' : 'Group info'} subtitle={g?.name} />}>
      {!g ? (
        <Card>
          <Skeleton width="60%" height={18} />
        </Card>
      ) : isOwner ? (
        <View style={{ gap: 14 }}>
          <Card style={{ gap: 18 }}>
            <Input label="Name" value={name} onChangeText={setName} maxLength={40} />
            <EmojiPicker value={emoji} onChange={setEmoji} />
            <ColorPicker value={color} onChange={setColor} />
            <Button title="Save changes" onPress={save} disabled={!dirty} loading={update.isPending && dirty} fullWidth />
          </Card>

          <Card>
            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text weight="medium">Simplify debts</Text>
                <Text variant="small" tone="muted">
                  Show the fewest transfers that settle everyone, instead of exact pairwise debts.
                </Text>
              </View>
              <Switch value={g.simplifyDebts} onValueChange={toggleSimplify} trackColor={{ true: t.colors.accent, false: t.colors.border }} thumbColor="#FFFFFF" />
            </View>
          </Card>

          <Card style={{ gap: 10 }}>
            <Text weight="medium">Invite code</Text>
            <Text variant="small" tone="muted">
              Current code: {g.inviteCode}
            </Text>
            <Button title="Regenerate code" variant="secondary" onPress={regenerate} loading={regen.isPending} />
          </Card>

          <Card style={{ gap: 10 }}>
            <Text weight="medium" tone="negative">
              Danger zone
            </Text>
            <Text variant="small" tone="muted">
              Deleting removes the group, its expenses and payments for every member.
            </Text>
            <Button title="Delete group" variant="danger" onPress={confirmDelete} loading={del.isPending} />
          </Card>
        </View>
      ) : (
        <Card style={{ gap: 8 }}>
          <Text weight="medium">Only the owner can change this group.</Text>
          <Text variant="small" tone="muted">
            Owner: {g.members.find((m) => m.role === 'owner')?.name ?? 'unknown'}. Debts are shown {g.simplifyDebts ? 'simplified' : 'pairwise'}.
          </Text>
          <Text variant="small" tone="muted">
            To leave, use the Members tab.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
