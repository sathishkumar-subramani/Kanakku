import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authApi, errorMessage } from '@/api';
import { qk } from '@/api/queries';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme/ThemeProvider';
import { hapticError, hapticSuccess, isValidEmail } from '@/utils/misc';
import { Button } from './Button';
import { Input } from './Input';
import { Screen } from './Screen';
import { WakingUpHint } from './States';
import { Text } from './Text';
import { Wordmark } from './Wordmark';

export function AuthForm({ mode }: { mode: 'sign-in' | 'register' }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const signIn = useAuthStore((s) => s.signIn);
  const wakingUp = useAuthStore((s) => s.wakingUp);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});

  const isRegister = mode === 'register';

  const validate = () => {
    const fe: typeof fieldErrors = {};
    if (isRegister && name.trim().length < 2) fe.name = 'Tell us your name.';
    if (!isValidEmail(email)) fe.email = 'Enter a valid email address.';
    if (password.length < 6) fe.password = 'Password needs at least 6 characters.';
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const submit = async () => {
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const res = isRegister
        ? await authApi.register({ name: name.trim(), email: email.trim().toLowerCase(), password })
        : await authApi.login({ email: email.trim().toLowerCase(), password });
      qc.clear();
      await signIn(res.user, { accessToken: res.accessToken, refreshToken: res.refreshToken });
      qc.setQueryData(qk.me, res.user);
      hapticSuccess();
      router.replace('/(tabs)');
    } catch (err) {
      hapticError();
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen keyboard contentStyle={[styles.content, { paddingTop: insets.top + 40 }]}>
      <Wordmark size={48} />
      <View style={styles.intro}>
        <Text variant="display">{isRegister ? 'Create your account' : 'Welcome back'}</Text>
        <Text tone="muted">
          {isRegister ? 'Keep track of what your room, trips and friends share.' : 'Sign in to pick up where you left off.'}
        </Text>
      </View>

      <WakingUpHint visible={wakingUp && busy} />

      <View style={styles.form}>
        {isRegister ? (
          <Input
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            error={fieldErrors.name}
            returnKeyType="next"
          />
        ) : null}
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          error={fieldErrors.email}
          returnKeyType="next"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder={isRegister ? 'At least 6 characters' : 'Your password'}
          secureTextEntry={!showPw}
          autoCapitalize="none"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          textContentType={isRegister ? 'newPassword' : 'password'}
          error={fieldErrors.password}
          returnKeyType="done"
          onSubmitEditing={submit}
          right={
            <Pressable onPress={() => setShowPw((v) => !v)} hitSlop={8} accessibilityLabel={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? <EyeOff size={18} color={t.colors.muted} /> : <Eye size={18} color={t.colors.muted} />}
            </Pressable>
          }
        />
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: t.colors.negativeSoft, borderRadius: t.radii.control }]}>
            <Text variant="small" tone="negative">
              {error}
            </Text>
          </View>
        ) : null}
        <Button title={isRegister ? 'Create account' : 'Sign in'} size="lg" onPress={submit} loading={busy} fullWidth style={{ marginTop: 6 }} />
      </View>

      <View style={styles.switchRow}>
        <Text tone="muted">{isRegister ? 'Already have an account?' : 'New here?'}</Text>
        <Pressable onPress={() => router.replace(isRegister ? '/(auth)/sign-in' : '/(auth)/register')} hitSlop={8}>
          <Text tone="accent" weight="semibold">
            {isRegister ? 'Sign in' : 'Create an account'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 24 },
  intro: { gap: 6, marginTop: 8 },
  form: { gap: 14 },
  errorBox: { paddingHorizontal: 12, paddingVertical: 10 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
});
