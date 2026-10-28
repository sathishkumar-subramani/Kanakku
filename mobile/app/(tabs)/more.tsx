import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ChevronRight, FileText, KeyRound, LogOut, Moon, Palette, UserRound } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { authApi, errorMessage } from '@/api';
import { useMe, useUpdateMe } from '@/api/queries';
import { API_URL } from '@/api/config';
import { Avatar } from '@/components/Avatar';
import { Card, Divider } from '@/components/Card';
import { Segmented } from '@/components/Chip';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { PageTitle, Screen } from '@/components/Screen';
import { useAuthStore } from '@/store/auth';
import type { ThemeMode } from '@/theme';
import { useTheme, useThemeMode } from '@/theme/ThemeProvider';
import { hapticSelect, hapticSuccess } from '@/utils/misc';
import { CURRENCIES, currencySymbol } from '@/utils/money';

export default function MoreScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const me = useMe();
  const update = useUpdateMe();
  const { mode, setMode } = useThemeMode();
  const tokens = useAuthStore((s) => s.tokens);
  const signOut = useAuthStore((s) => s.signOut);
  const user = me.data;
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const doSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          const rt = tokens?.refreshToken;
          if (rt) authApi.logout(rt).catch(() => undefined);
          await signOut();
          qc.clear();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  };

  const pickCurrency = async (code: string) => {
    setCurrencyOpen(false);
    if (!user || code === user.currency) return;
    try {
      await update.mutateAsync({ currency: code });
      hapticSuccess();
    } catch (err) {
      Alert.alert("Couldn't update currency", errorMessage(err));
    }
  };

  return (
    <Screen header={<PageTitle title="More" />}>
      <Card padded={false} style={styles.card}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/more/profile')} style={({ pressed }) => [styles.profile, pressed && { backgroundColor: t.colors.surface2 }]}>
          {user ? <Avatar name={user.name} color={user.avatarColor} size={52} /> : <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: t.colors.surface2 }} />}
          <View style={{ flex: 1 }}>
            <Text variant="h2">{user?.name ?? '—'}</Text>
            <Text variant="small" tone="muted">
              {user?.email ?? ''}
            </Text>
          </View>
          <ChevronRight size={18} color={t.colors.muted} />
        </Pressable>
      </Card>

      <Text variant="micro" tone="muted" weight="semibold" style={styles.sectionLabel}>
        PREFERENCES
      </Text>
      <Card padded={false} style={styles.card}>
        <Row icon={<Palette size={18} color={t.colors.accent} />} title="Currency" value={user ? `${user.currency} ${currencySymbol(user.currency)}` : ''} onPress={() => setCurrencyOpen(true)} />
        <Divider inset={56} />
        <View style={styles.themeRow}>
          <View style={[styles.rowIcon, { backgroundColor: t.colors.accentSoft }]}>
            <Moon size={18} color={t.colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="medium" style={{ marginBottom: 8 }}>
              Theme
            </Text>
            <Segmented<ThemeMode>
              value={mode}
              onChange={(m) => {
                hapticSelect();
                setMode(m);
              }}
              options={[
                { value: 'system', label: 'System' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
            />
          </View>
        </View>
      </Card>

      <Text variant="micro" tone="muted" weight="semibold" style={styles.sectionLabel}>
        ACCOUNT
      </Text>
      <Card padded={false} style={styles.card}>
        <Row icon={<UserRound size={18} color={t.colors.accent} />} title="Profile" value="Name, avatar colour" onPress={() => router.push('/more/profile')} />
        <Divider inset={56} />
        <Row icon={<KeyRound size={18} color={t.colors.accent} />} title="Change password" onPress={() => router.push('/more/password')} />
        <Divider inset={56} />
        <Row icon={<FileText size={18} color={t.colors.accent} />} title="Reports" value="PDF and CSV by month" onPress={() => router.push('/more/reports')} />
      </Card>

      <Card padded={false} style={styles.card}>
        <Row icon={<LogOut size={18} color={t.colors.negative} />} title="Sign out" onPress={doSignOut} danger />
      </Card>

      <Text variant="micro" tone="muted" center style={{ marginTop: 10 }}>
        Kanakku {version} · {API_URL.replace(/^https?:\/\//, '')}
      </Text>

      <Sheet visible={currencyOpen} onClose={() => setCurrencyOpen(false)} title="Currency">
        {CURRENCIES.map((c) => {
          const active = user?.currency === c.code;
          return (
            <Pressable key={c.code} accessibilityRole="button" onPress={() => pickCurrency(c.code)} style={({ pressed }) => [styles.option, { backgroundColor: active ? t.colors.accentSoft : pressed ? t.colors.surface2 : 'transparent', borderRadius: t.radii.control }]}>
              <Text weight="semibold" mono style={{ width: 44 }}>
                {currencySymbol(c.code).trim()}
              </Text>
              <View style={{ flex: 1 }}>
                <Text weight={active ? 'semibold' : 'regular'}>{c.code}</Text>
                <Text variant="micro" tone="muted">
                  {c.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
        <Text variant="micro" tone="muted" style={{ marginTop: 4 }}>
          Changes how amounts are displayed. Existing numbers are not converted.
        </Text>
      </Sheet>
    </Screen>
  );
}

function Row({ icon, title, value, onPress, danger }: { icon: React.ReactNode; title: string; value?: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.colors.surface2 }]}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? t.colors.negativeSoft : t.colors.accentSoft }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text weight="medium" tone={danger ? 'negative' : 'text'}>
          {title}
        </Text>
        {value ? (
          <Text variant="small" tone="muted">
            {value}
          </Text>
        ) : null}
      </View>
      {!danger ? <ChevronRight size={18} color={t.colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, overflow: 'hidden' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  sectionLabel: { letterSpacing: 0.6, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  themeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 10 },
});
