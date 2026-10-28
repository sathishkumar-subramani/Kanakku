import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { formatMonthLabel, isFutureMonth, shiftMonth } from '@/utils/dates';
import { hapticSelect } from '@/utils/misc';
import { Text } from './Text';

export function MonthPicker({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (month: string) => void;
  compact?: boolean;
}) {
  const t = useTheme();
  const next = shiftMonth(value, 1);
  const canGoNext = !isFutureMonth(next);
  const btn = (disabled: boolean) => [
    styles.btn,
    { backgroundColor: t.colors.surface2, opacity: disabled ? 0.35 : 1, borderRadius: t.radii.control },
  ];
  return (
    <View style={[styles.row, compact && styles.compact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        hitSlop={8}
        onPress={() => {
          hapticSelect();
          onChange(shiftMonth(value, -1));
        }}
        style={btn(false)}
      >
        <ChevronLeft size={18} color={t.colors.text} />
      </Pressable>
      <Text variant={compact ? 'label' : 'h2'} style={styles.label} center>
        {formatMonthLabel(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next month"
        hitSlop={8}
        disabled={!canGoNext}
        onPress={() => {
          hapticSelect();
          onChange(next);
        }}
        style={btn(!canGoNext)}
      >
        <ChevronRight size={18} color={t.colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  compact: { gap: 6 },
  btn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  label: { minWidth: 96 },
});
