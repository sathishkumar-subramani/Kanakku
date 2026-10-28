import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { currencySymbol } from '@/utils/money';
import { Text } from './Text';

/** Large money entry, DM Mono, currency symbol on the left. */
export function AmountInput({
  value,
  onChangeText,
  currency,
  label,
  autoFocus,
  error,
}: {
  value: string;
  onChangeText: (v: string) => void;
  currency: string;
  label?: string;
  autoFocus?: boolean;
  error?: string;
}) {
  const t = useTheme();
  const clean = (v: string) => {
    // digits and a single dot with max 2 decimals
    let s = v.replace(/[^\d.]/g, '');
    const firstDot = s.indexOf('.');
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
      const [a, b] = s.split('.');
      s = `${a ?? ''}.${(b ?? '').slice(0, 2)}`;
    }
    if (s.length > 1 && s.startsWith('0') && !s.startsWith('0.')) s = s.replace(/^0+/, '');
    onChangeText(s);
  };
  return (
    <View>
      {label ? (
        <Text variant="label" tone="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.box, { borderColor: error ? t.colors.negative : t.colors.border, backgroundColor: t.colors.surface2, borderRadius: t.radii.control }]}>
        <Text style={[styles.symbol, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{currencySymbol(currency)}</Text>
        <TextInput
          value={value}
          onChangeText={clean}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0"
          placeholderTextColor={t.colors.muted}
          selectionColor={t.colors.accent}
          cursorColor={t.colors.accent}
          autoFocus={autoFocus}
          style={[styles.input, { color: t.colors.text, fontFamily: t.fonts.mono }]}
          maxLength={12}
        />
      </View>
      {error ? (
        <Text variant="small" tone="negative" style={{ marginTop: 6 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  box: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: 16, minHeight: 72 },
  symbol: { fontSize: 28, marginRight: 8 },
  input: { flex: 1, fontSize: 36, paddingVertical: 12, minHeight: 70 },
});
