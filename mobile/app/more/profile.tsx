import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useMe, useUpdateMe } from '@/api/queries';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ColorPicker } from '@/components/GroupForm';
import { Input } from '@/components/Input';
import { Header, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { AVATAR_PALETTE } from '@/theme';
import { hapticError, hapticSuccess } from '@/utils/misc';

export default function ProfileScreen() {
  const router = useRouter();
  const me = useMe();
  const update = useUpdateMe();
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVATAR_PALETTE[0] ?? '#E2590B');
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (me.data && !seeded) {
      setName(me.data.name);
      setColor(me.data.avatarColor);
      setSeeded(true);
    }
  }, [me.data, seeded]);

  const dirty = !!me.data && (name.trim() !== me.data.name || color.toLowerCase() !== me.data.avatarColor.toLowerCase());

  const save = async () => {
    if (name.trim().length < 2) {
      Alert.alert('Name needed', 'Enter at least 2 characters.');
      return;
    }
    try {
      await update.mutateAsync({ name: name.trim(), avatarColor: color });
      hapticSuccess();
      router.back();
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save", errorMessage(err));
    }
  };

  return (
    <Screen keyboard header={<Header title="Profile" />}>
      <View style={styles.preview}>
        <Avatar name={name || me.data?.name || '?'} color={color} size={84} />
        <Text variant="small" tone="muted">
          {me.data?.email}
        </Text>
      </View>
      <Card style={{ gap: 18 }}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" maxLength={40} />
        <ColorPicker label="Avatar colour" value={color} onChange={setColor} palette={AVATAR_PALETTE} />
        <Button title="Save" onPress={save} disabled={!dirty} loading={update.isPending} fullWidth />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { alignItems: 'center', gap: 8, marginVertical: 18 },
});
