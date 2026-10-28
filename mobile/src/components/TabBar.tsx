import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Home, Plus, Users, Wallet, Menu } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { hapticLight, hapticSelect } from '@/utils/misc';
import { Text } from './Text';

const ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  index: Home,
  groups: Users,
  personal: Wallet,
  more: Menu,
};

const LABELS: Record<string, string> = {
  index: 'Home',
  groups: 'Groups',
  personal: 'Personal',
  more: 'More',
};

/** Custom bottom bar: Home · Groups · [+] · Personal · More */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const t = useTheme();
  const router = useRouter();
  const routes = state.routes.filter((r) => r.name in ICONS);
  const left = routes.slice(0, 2);
  const right = routes.slice(2, 4);

  const renderTab = (route: (typeof routes)[number]) => {
    const index = state.routes.findIndex((r) => r.key === route.key);
    const focused = index === state.index;
    const Icon = ICONS[route.name] ?? Home;
    const label = (descriptors[route.key]?.options.title as string | undefined) ?? LABELS[route.name] ?? route.name;
    const color = focused ? t.colors.accent : t.colors.muted;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        onPress={() => {
          const ev = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !ev.defaultPrevented) {
            hapticSelect();
            navigateToTab(route.key);
          }
        }}
        style={styles.tab}
      >
        <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
        <Text variant="micro" weight={focused ? 'semibold' : 'medium'} style={{ color }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
        },
      ]}
    >
      {left.map(renderTab)}
      <View style={styles.fabSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add expense"
          onPress={() => {
            hapticLight();
            router.push('/expense/new');
          }}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: t.colors.accent, transform: [{ scale: pressed ? 0.95 : 1 }] },
            t.scheme === 'light' && styles.fabShadow,
          ]}
        >
          <Plus size={28} color={t.colors.onAccent} strokeWidth={2.6} />
        </Pressable>
      </View>
      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 4 },
  fabSlot: { width: 72, alignItems: 'center', justifyContent: 'flex-end' },
  fab: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: -26 },
  fabShadow: {
    shadowColor: '#E2590B',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});
