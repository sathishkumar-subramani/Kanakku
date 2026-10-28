import { Check } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GROUP_EMOJIS, GROUP_PALETTE } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { hapticSelect } from '@/utils/misc';
import { Text } from './Text';

export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const t = useTheme();
  return (
    <View>
      <Text variant="label" tone="muted" style={styles.label}>
        Emoji
      </Text>
      <View style={styles.wrap}>
        {GROUP_EMOJIS.map((e) => {
          const active = e === value;
          return (
            <Pressable
              key={e}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                hapticSelect();
                onChange(e);
              }}
              style={[
                styles.emojiCell,
                { backgroundColor: active ? t.colors.accentSoft : t.colors.surface2, borderColor: active ? t.colors.accent : t.colors.border },
              ]}
            >
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ColorPicker({ value, onChange, palette = GROUP_PALETTE, label = 'Colour' }: { value: string; onChange: (c: string) => void; palette?: string[]; label?: string }) {
  const t = useTheme();
  return (
    <View>
      <Text variant="label" tone="muted" style={styles.label}>
        {label}
      </Text>
      <View style={styles.wrap}>
        {palette.map((c) => {
          const active = c.toLowerCase() === value.toLowerCase();
          return (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Colour ${c}`}
              onPress={() => {
                hapticSelect();
                onChange(c);
              }}
              style={[styles.swatch, { backgroundColor: c, borderColor: active ? t.colors.text : 'transparent' }]}
            >
              {active ? <Check size={16} color="#FFFFFF" strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emojiCell: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  emoji: { fontSize: 22, lineHeight: 28 },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
});
