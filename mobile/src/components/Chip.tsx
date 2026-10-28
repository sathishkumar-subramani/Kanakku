import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CATEGORY_ORDER, categoryMeta, type Category } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { hapticSelect } from '@/utils/misc';
import { Text } from './Text';

export function Chip({
  label,
  selected,
  onPress,
  color,
  emoji,
  style,
  small,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  emoji?: string;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const t = useTheme();
  const tint = color ?? t.colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={() => {
        hapticSelect();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        small && styles.small,
        {
          backgroundColor: selected ? `${tint}22` : t.colors.surface2,
          borderColor: selected ? tint : t.colors.border,
          borderRadius: t.radii.pill,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
      <Text variant={small ? 'micro' : 'label'} weight="medium" style={{ color: selected ? tint : t.colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function CategoryChips({
  value,
  onChange,
  includeAll,
}: {
  value: Category | null;
  onChange: (c: Category | null) => void;
  includeAll?: boolean;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {includeAll ? <Chip label="All" selected={value === null} onPress={() => onChange(null)} /> : null}
      {CATEGORY_ORDER.map((c) => {
        const meta = categoryMeta(c);
        return (
          <Chip
            key={c}
            label={meta.label}
            emoji={meta.emoji}
            color={meta.color}
            selected={value === c}
            onPress={() => onChange(c)}
          />
        );
      })}
    </ScrollView>
  );
}

/** Wrapping grid of category chips for forms. */
export function CategoryGrid({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <View style={styles.wrap}>
      {CATEGORY_ORDER.map((c) => {
        const meta = categoryMeta(c);
        return (
          <Chip
            key={c}
            label={meta.label}
            emoji={meta.emoji}
            color={meta.color}
            selected={value === c}
            onPress={() => onChange(c)}
          />
        );
      })}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: t.colors.surface2, borderRadius: t.radii.control }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              hapticSelect();
              onChange(o.value);
            }}
            style={[
              styles.segmentItem,
              { borderRadius: t.radii.control - 3 },
              active && { backgroundColor: t.colors.surface, ...t.cardShadow },
            ]}
          >
            <Text variant="label" weight={active ? 'semibold' : 'medium'} tone={active ? 'text' : 'muted'} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  small: { paddingHorizontal: 10, paddingVertical: 5 },
  emoji: { fontSize: 14, lineHeight: 18 },
  scroll: { gap: 8, paddingRight: 16 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: { flexDirection: 'row', padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 6 },
});
