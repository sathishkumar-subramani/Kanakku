import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage } from '@/api';
import { useJoinGroup } from '@/api/queries';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Header, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { hapticError, hapticSuccess } from '@/utils/misc';

export default function JoinGroupScreen() {
  const router = useRouter();
  const join = useJoinGroup();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (code.trim().length < 4) {
      setError('Enter the invite code you were given.');
      return;
    }
    try {
      const g = await join.mutateAsync(code);
      hapticSuccess();
      router.replace(`/group/${g.id}`);
    } catch (err) {
      hapticError();
      const e = err instanceof ApiError ? err : null;
      setError(e?.status === 404 ? "That invite code didn't match any group." : e?.status === 409 ? "You're already in that group." : errorMessage(err));
    }
  };

  return (
    <Screen keyboard header={<Header title="Join with code" subtitle="Ask a member for the group's invite code." />}>
      <View style={styles.form}>
        <Input
          label="Invite code"
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase())}
          placeholder="e.g. 7K3P9Q"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          mono
          style={styles.codeInput}
          returnKeyType="go"
          onSubmitEditing={submit}
          error={error ?? undefined}
        />
        <Button title="Join group" size="lg" onPress={submit} loading={join.isPending} fullWidth />
        <Text variant="small" tone="muted" center>
          Members can find the code under the group's Members tab.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 18, marginTop: 12 },
  codeInput: { fontSize: 22, letterSpacing: 4, textAlign: 'center' },
});
