import React, { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { BarChart, PieChart, type barDataItem, type pieDataItem } from 'react-native-gifted-charts';

import type { DashboardCategorySlice, DashboardDay, DashboardGroupSlice } from '@/api/types';
import { categoryMeta } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { dayOfMonth } from '@/utils/dates';
import { formatMoney, formatMoneyShort } from '@/utils/money';
import { Money, Text } from './Text';

/** Horizontal bars: my share per group (incl. Personal). Hand-rolled with Views for crisp control. */
export function GroupBars({ data, currency }: { data: DashboardGroupSlice[]; currency: string }) {
  const t = useTheme();
  const max = Math.max(...data.map((d) => d.amount), 0.01);
  return (
    <View style={{ gap: 12 }}>
      {data.map((g) => {
        const pct = Math.max(0.02, g.amount / max);
        return (
          <View key={g.groupId} style={{ gap: 6 }}>
            <View style={styles.barLabelRow}>
              <Text variant="small" weight="medium" numberOfLines={1} style={{ flex: 1 }}>
                {g.emoji} {g.name}
              </Text>
              <Money variant="small">{formatMoney(g.amount, currency)}</Money>
            </View>
            <View style={[styles.track, { backgroundColor: t.colors.surface2 }]}>
              <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: g.color || t.colors.accent }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Donut by category with legend. */
export function CategoryDonut({ data, currency, total }: { data: DashboardCategorySlice[]; currency: string; total: number }) {
  const t = useTheme();
  const [focused, setFocused] = useState<number | null>(null);
  const sorted = useMemo(() => [...data].filter((d) => d.amount > 0).sort((a, b) => b.amount - a.amount), [data]);
  const pie: pieDataItem[] = sorted.map((d, i) => ({
    value: d.amount,
    color: categoryMeta(d.category).color,
    focused: focused === i,
  }));
  const sum = sorted.reduce((s, d) => s + d.amount, 0) || total || 1;
  const centre = focused !== null && sorted[focused] ? sorted[focused] : null;

  return (
    <View style={styles.donutRow}>
      <PieChart
        data={pie}
        donut
        radius={74}
        innerRadius={52}
        innerCircleColor={t.colors.surface}
        strokeWidth={2}
        strokeColor={t.colors.surface}
        focusOnPress
        toggleFocusOnPress
        sectionAutoFocus={false}
        onPress={(_item: pieDataItem, index: number) => setFocused((f) => (f === index ? null : index))}
        centerLabelComponent={() => (
          <View style={{ alignItems: 'center' }}>
            {centre ? (
              <>
                <Text style={{ fontSize: 18, lineHeight: 22 }}>{categoryMeta(centre.category).emoji}</Text>
                <Money variant="small">{formatMoney(centre.amount, currency, { compact: true })}</Money>
                <Text variant="micro" tone="muted">
                  {Math.round((centre.amount / sum) * 100)}%
                </Text>
              </>
            ) : (
              <>
                <Text variant="micro" tone="muted">
                  Total
                </Text>
                <Money variant="small">{formatMoney(sum, currency, { compact: true })}</Money>
              </>
            )}
          </View>
        )}
      />
      <View style={styles.legend}>
        {sorted.slice(0, 6).map((d, i) => {
          const meta = categoryMeta(d.category);
          return (
            <View key={d.category} style={[styles.legendRow, focused !== null && focused !== i && { opacity: 0.45 }]}>
              <View style={[styles.dot, { backgroundColor: meta.color }]} />
              <Text variant="small" numberOfLines={1} style={{ flex: 1 }}>
                {meta.label}
              </Text>
              <Text variant="small" tone="muted">
                {Math.round((d.amount / sum) * 100)}%
              </Text>
            </View>
          );
        })}
        {sorted.length > 6 ? (
          <Text variant="micro" tone="muted">
            +{sorted.length - 6} more
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Daily spend for the month as slim bars. */
export function DailyBars({ data, currency }: { data: DashboardDay[]; currency: string }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(240, width - 16 * 2 - 16 * 2 - 40); // page gutter + card padding + y-axis
  const n = Math.max(data.length, 1);
  const spacing = 3;
  const barWidth = Math.max(3, Math.floor((chartWidth - spacing * n) / n));
  const max = Math.max(...data.map((d) => d.amount), 1);

  const bars: barDataItem[] = data.map((d) => {
    const day = dayOfMonth(d.date);
    const showLabel = day === 1 || day % 5 === 0;
    return {
      value: d.amount,
      label: showLabel ? String(day) : '',
      frontColor: d.amount > 0 ? t.colors.accent : t.colors.surface2,
      labelTextStyle: { color: t.colors.muted, fontSize: 10, fontFamily: t.fonts.medium },
    };
  });

  const totalDays = data.length;
  const activeDays = data.filter((d) => d.amount > 0).length;

  return (
    <View>
      <BarChart
        data={bars}
        width={chartWidth}
        height={120}
        barWidth={barWidth}
        spacing={spacing}
        initialSpacing={4}
        endSpacing={4}
        maxValue={max * 1.1}
        noOfSections={3}
        barBorderRadius={2}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={t.colors.border}
        rulesColor={t.colors.border}
        rulesType="solid"
        yAxisTextStyle={{ color: t.colors.muted, fontSize: 10, fontFamily: t.fonts.mono }}
        yAxisLabelWidth={40}
        formatYLabel={(v: string) => formatMoneyShort(Number(v), currency)}
        xAxisLabelTextStyle={{ color: t.colors.muted, fontSize: 10 }}
        disableScroll
        isAnimated
        animationDuration={300}
        renderTooltip={(item: barDataItem, index: number) => (
          <View style={[styles.tooltip, { backgroundColor: t.colors.text }]}>
            <Text variant="micro" style={{ color: t.colors.bg }}>
              {index + 1}: {formatMoney(item.value ?? 0, currency)}
            </Text>
          </View>
        )}
        leftShiftForTooltip={20}
        leftShiftForLastIndexTooltip={60}
      />
      <Text variant="micro" tone="muted" style={{ marginTop: 6 }}>
        {totalDays > 0 ? `Days 1–${totalDays} · spent on ${activeDays} ${activeDays === 1 ? 'day' : 'days'} · tap a bar for the amount` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  barLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, gap: 8 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tooltip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
});
