import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { ApiError, errorMessage } from '@/api';
import { useChangePassword } from '@/api/queries';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Header, Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { hapticError, hapticSuccess } from '@/utils/misc';

export default function PasswordScreen() {
  const router = useRouter();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSave = current.length > 0 && next.length >= 6 && next === confirm;

  const save = async () => {
    setError(null);
    if (next.length < 6) return setError('New password needs at least 6 characters.');
    if (next !== confirm) return setError("Those passwords don't match.");
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      hapticSuccess();
      Alert.alert('Password changed', 'Other devices will need to sign in again.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      hapticError();
      const e = err instanceof ApiError ? err : null;
      setError(e?.status === 400 || e?.status === 401 || e?.status === 403 ? "That current password isn't right." : errorMessage(err));
    }
  };

  return (
    <Screen keyboard header={<Header title="Change password" />}>
      <Card style={{ gap: 14, marginTop: 8 }}>
        <Input label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" textContentType="password" />
        <Input label="New password" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" textContentType="newPassword" hint="At least 6 characters." />
        <Input label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" textContentType="newPassword" error={confirm && confirm !== next ? "Doesn't match." : undefined} onSubmitEditing={save} returnKeyType="done" />
        {error ? (
          <Text variant="small" tone="negative">
            {error}
          </Text>
        ) : null}
        <Button title="Update password" onPress={save} disabled={!canSave} loading={change.isPending} fullWidth />
      </Card>
      <View style={{ height: 12 }} />
    </Screen>
  );
}
