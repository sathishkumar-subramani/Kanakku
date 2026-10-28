import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { Providers } from '@/components/Providers';
import { useAuthStore } from '@/store/auth';
import { useTheme, useThemeMode } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 250, fade: true });

export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate().catch(() => useAuthStore.getState().signOut());
  }, [hydrate]);

  const ready = (fontsLoaded || !!fontError) && status !== 'loading';

  return (
    <Providers>
      <Root ready={ready} />
    </Providers>
  );
}

function Root({ ready }: { ready: boolean }) {
  const t = useTheme();
  const { ready: themeReady } = useThemeMode();
  const status = useAuthStore((s) => s.status);
  const allReady = ready && themeReady;

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.colors.bg).catch(() => undefined);
  }, [t.colors.bg]);

  useEffect(() => {
    if (allReady) SplashScreen.hideAsync().catch(() => undefined);
  }, [allReady]);

  if (!allReady) return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;

  const navTheme = {
    ...(t.scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(t.scheme === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: t.colors.accent,
      background: t.colors.bg,
      card: t.colors.surface,
      text: t.colors.text,
      border: t.colors.border,
      notification: t.colors.accent,
    },
  };

  const signedIn = status === 'signedIn';

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 200,
          contentStyle: { backgroundColor: t.colors.bg },
        }}
      >
        <Stack.Protected guard={!signedIn} redirectTo="/(tabs)">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn} redirectTo="/(auth)/sign-in">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="group/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="group/[id]/settle" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="group/[id]/settings" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="group/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="group/join" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="expense/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="expense/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="expense/[id]/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="personal/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="personal/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="more/profile" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/password" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="more/reports" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  );
}
