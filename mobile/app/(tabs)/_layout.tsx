import { Tabs } from 'expo-router/js-tabs';
import React from 'react';

import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/theme/ThemeProvider';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.colors.bg },
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.muted,
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="personal" options={{ title: 'Personal' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
