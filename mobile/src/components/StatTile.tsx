import { TrendingDown, TrendingUp } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { formatMoney } from '@/utils/money';
import { Card } from './Card';
import { Money, Text } from './Text';

export function StatTile({
  label,
  value,
  currency,
  tone = 'text',
  trend,
  hint,
}: {
  label: string;
  value: number;
  currency: string;
  tone?: 'text' | 'positive' | 'negative';
  /** Previous-month value → shows a trend chip. */
  trend?: { prev: number };
  hint?: string;
}) {
  const t = useTheme();
  let chip: React.ReactNode = null;
  if (trend) {
    const { prev } = trend;
    if (prev > 0 || value > 0) {
      const delta = prev > 0 ? ((value - prev) / prev) * 100 : 100;
      const up = delta > 0.5;
      const down = delta < -0.5;
      const color = up ? t.colors.negative : down ? t.colors.positive : t.colors.muted;
      const bg = up ? t.colors.negativeSoft : down ? t.colors.positiveSoft : t.colors.surface2;
      const label = prev > 0 ? `${Math.abs(Math.round(delta))}%` : 'new';
      chip = (
        <View style={[styles.chip, { backgroundColor: bg }]}>
          {up ? <TrendingUp size={11} color={color} /> : down ? <TrendingDown size={11} color={color} /> : null}
          <Text variant="micro" weight="semibold" style={{ color }}>
            {label}
          </Text>
        </View>
      );
    }
  }
  return (
    <Card style={styles.tile}>
      <View style={styles.top}>
        <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
          {label.toUpperCase()}
        </Text>
        {chip}
      </View>
      <Money variant="h2" tone={tone} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(value, currency)}
      </Money>
      {hint ? (
        <Text variant="micro" tone="muted" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  caps: { letterSpacing: 0.6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
});
