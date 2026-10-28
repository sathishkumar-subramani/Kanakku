import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { initials } from '@/utils/misc';
import { Text } from './Text';

export function Avatar({
  name,
  color,
  size = 32,
  style,
}: {
  name: string;
  color: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
      accessibilityLabel={name}
    >
      <Text weight="bold" style={{ color: '#FFFFFF', fontSize: Math.max(10, size * 0.38), lineHeight: size * 0.5 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function AvatarStack({
  people,
  size = 26,
  max = 4,
}: {
  people: { name: string; avatarColor: string }[];
  size?: number;
  max?: number;
}) {
  const t = useTheme();
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={styles.stack}>
      {shown.map((p, i) => (
        <Avatar
          key={`${p.name}-${i}`}
          name={p.name}
          color={p.avatarColor}
          size={size}
          style={[{ marginLeft: i === 0 ? 0 : -size * 0.3, borderWidth: 2, borderColor: t.colors.surface }]}
        />
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              marginLeft: -size * 0.3,
              backgroundColor: t.colors.surface2,
              borderWidth: 2,
              borderColor: t.colors.surface,
            },
          ]}
        >
          <Text variant="micro" tone="muted" weight="semibold">
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function EmojiBadge({ emoji, color, size = 44 }: { emoji: string; color: string; size?: number }) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${color}22` },
      ]}
    >
      <Text style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center' },
});
