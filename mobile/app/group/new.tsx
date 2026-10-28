import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useCreateGroup, useMe } from '@/api/queries';
import { Button } from '@/components/Button';
import { ColorPicker, EmojiPicker } from '@/components/GroupForm';
import { Input } from '@/components/Input';
import { Header, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { GROUP_EMOJIS, GROUP_PALETTE } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { hapticError, hapticSuccess } from '@/utils/misc';

export default function NewGroupScreen() {
  const t = useTheme();
  const router = useRouter();
  const me = useMe();
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(GROUP_EMOJIS[0] ?? '🏠');
  const [color, setColor] = useState(GROUP_PALETTE[0] ?? '#E2590B');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError('Give the group a name.');
      return;
    }
    try {
      const g = await create.mutateAsync({ name: name.trim(), emoji, color, currency: me.data?.currency ?? 'INR' });
      hapticSuccess();
      router.replace(`/group/${g.id}`);
    } catch (err) {
      hapticError();
      setError(errorMessage(err));
    }
  };

  return (
    <Screen keyboard header={<Header title="New group" subtitle="Everyone you add shares this ledger." />}>
      <View style={styles.preview}>
        <View style={[styles.previewBadge, { backgroundColor: `${color}22` }]}>
          <Text style={{ fontSize: 34, lineHeight: 42 }}>{emoji}</Text>
        </View>
        <Text variant="h1" numberOfLines={1} center>
          {name.trim() || 'Group name'}
        </Text>
      </View>
      <View style={styles.form}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. Flat 3B, Goa trip" autoFocus maxLength={40} returnKeyType="done" onSubmitEditing={save} />
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <ColorPicker value={color} onChange={setColor} />
        {error ? (
          <Text variant="small" tone="negative">
            {error}
          </Text>
        ) : null}
        <Button title="Create group" size="lg" onPress={save} loading={create.isPending} fullWidth />
        <Text variant="small" tone="muted" center>
          Currency follows your profile ({me.data?.currency ?? 'INR'}).
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: t.colors.bg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', gap: 10, marginVertical: 16 },
  previewBadge: { width: 76, height: 76, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 18 },
});
