import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { hapticLight } from '@/utils/misc';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'positive';
type Size = 'md' | 'sm' | 'lg';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  haptic?: boolean;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
  fullWidth,
  haptic = true,
}: ButtonProps) {
  const t = useTheme();
  const c = t.colors;
  const isDisabled = disabled || loading;

  const palette = (() => {
    switch (variant) {
      case 'primary':
        return { bg: c.accent, fg: c.onAccent, border: c.accent };
      case 'secondary':
        return { bg: c.surface2, fg: c.text, border: c.surface2 };
      case 'ghost':
        return { bg: 'transparent', fg: c.accent, border: 'transparent' };
      case 'danger':
        return { bg: c.negativeSoft, fg: c.negative, border: c.negativeSoft };
      case 'positive':
        return { bg: c.positiveSoft, fg: c.positive, border: c.positiveSoft };
    }
  })();

  const h = size === 'lg' ? 52 : size === 'sm' ? 36 : 46;
  const px = size === 'sm' ? 12 : 18;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => {
        if (haptic) hapticLight();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: h,
          paddingHorizontal: px,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: t.radii.control,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        fullWidth && styles.full,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text variant={size === 'sm' ? 'label' : 'body'} weight="semibold" style={{ color: palette.fg }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  full: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { marginRight: 2 },
});
