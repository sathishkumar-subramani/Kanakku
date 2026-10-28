import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export type CardProps = ViewProps & {
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function Card({ padded = true, onPress, style, children, ...rest }: CardProps) {
  const t = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.border,
      borderRadius: t.radii.card,
      padding: padded ? t.spacing.card : 0,
    },
    t.cardShadow,
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.9 }]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={base} {...rest}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, right, style }: { title: string; right?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text variant="h2">{title}</Text>
      {right}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginLeft: inset }} />;
}

export function Row({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.row, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
