import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export function Skeleton({ width, height = 14, radius = 8, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  const v = useSharedValue(0.5);
  useEffect(() => {
    v.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [v]);
  const anim = useAnimatedStyle(() => ({ opacity: v.value }));
  return (
    <Animated.View
      style={[{ width: width ?? '100%', height, borderRadius: radius, backgroundColor: t.colors.surface2 }, anim, style]}
    />
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ gap: 14 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skelRow}>
          <Skeleton width={40} height={40} radius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="60%" />
            <Skeleton width="35%" height={11} />
          </View>
          <Skeleton width={64} height={16} />
        </View>
      ))}
    </View>
  );
}

export function EmptyState({
  emoji = '📒',
  title,
  body,
  actionTitle,
  onAction,
  compact,
}: {
  emoji?: string;
  title: string;
  body?: string;
  actionTitle?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[styles.empty, compact && styles.emptyCompact]}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text variant="h2" center>
        {title}
      </Text>
      {body ? (
        <Text tone="muted" center style={styles.emptyBody}>
          {body}
        </Text>
      ) : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} style={styles.emptyBtn} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🪫</Text>
      <Text variant="h2" center>
        Something went wrong
      </Text>
      <Text tone="muted" center style={styles.emptyBody}>
        {message}
      </Text>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} style={styles.emptyBtn} /> : null}
    </View>
  );
}

export function WakingUpHint({ visible }: { visible: boolean }) {
  const t = useTheme();
  if (!visible) return null;
  return (
    <View style={[styles.wake, { backgroundColor: t.colors.accentSoft, borderRadius: t.radii.control }]}>
      <Text variant="small" tone="accent" weight="medium">
        Waking up the server… this can take up to a minute the first time.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  skelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 6 },
  emptyCompact: { paddingVertical: 24 },
  emptyEmoji: { fontSize: 34, lineHeight: 42, marginBottom: 4 },
  emptyBody: { maxWidth: 280 },
  emptyBtn: { marginTop: 12 },
  wake: { paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
});
