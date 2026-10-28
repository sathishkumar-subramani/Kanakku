import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Expense, PersonalExpense } from '@/api/types';
import { categoryMeta } from '@/theme';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDayHeading } from '@/utils/dates';
import { firstName } from '@/utils/misc';
import { formatMoney } from '@/utils/money';
import { Money, Text } from './Text';

export function CategoryIcon({ category, size = 42 }: { category: string; size?: number }) {
  const meta = categoryMeta(category);
  return (
    <View
      style={[
        styles.catIcon,
        { width: size, height: size, borderRadius: size * 0.32, backgroundColor: `${meta.color}22` },
      ]}
    >
      <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.6 }}>{meta.emoji}</Text>
    </View>
  );
}

export function DayHeading({ day, total, currency }: { day: string; total?: number; currency?: string }) {
  return (
    <View style={styles.dayHeading}>
      <Text variant="micro" tone="muted" weight="semibold" style={styles.caps}>
        {formatDayHeading(day).toUpperCase()}
      </Text>
      {total !== undefined ? (
        <Money variant="micro" tone="muted">
          {formatMoney(total, currency)}
        </Money>
      ) : null}
    </View>
  );
}

/** Group expense row. */
export function ExpenseRow({
  expense,
  meId,
  onPress,
  showGroup,
  currency,
}: {
  expense: Expense;
  meId?: string;
  onPress?: () => void;
  showGroup?: boolean;
  currency?: string;
}) {
  const t = useTheme();
  const isPersonal = expense.groupId === 'personal';
  const paidByMe = expense.paidBy.id === meId;
  const cur = currency ?? expense.currency;

  let sub: string;
  let subTone: 'muted' | 'positive' | 'negative' = 'muted';
  if (isPersonal) {
    sub = showGroup ? 'Personal' : categoryMeta(expense.category).label;
  } else if (paidByMe) {
    const lent = expense.amount - expense.myShare;
    sub = lent > 0.004 ? `You paid · you lent ${formatMoney(lent, cur)}` : 'You paid';
    subTone = lent > 0.004 ? 'positive' : 'muted';
  } else if (expense.myShare > 0.004) {
    sub = `${firstName(expense.paidBy.name)} paid · your share ${formatMoney(expense.myShare, cur)}`;
    subTone = 'negative';
  } else {
    sub = `${firstName(expense.paidBy.name)} paid · not involved`;
  }
  if (showGroup && !isPersonal) sub = `${expense.groupEmoji} ${expense.groupName} · ${sub}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.colors.surface2 }]}
    >
      <CategoryIcon category={expense.category} />
      <View style={styles.rowBody}>
        <Text weight="medium" numberOfLines={1}>
          {expense.description}
        </Text>
        <Text variant="small" tone={subTone} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Money>{formatMoney(expense.amount, cur)}</Money>
        {onPress ? <ChevronRight size={16} color={t.colors.border} /> : null}
      </View>
    </Pressable>
  );
}

export function PersonalRow({ item, currency, onPress }: { item: PersonalExpense; currency: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.colors.surface2 }]}
    >
      <CategoryIcon category={item.category} />
      <View style={styles.rowBody}>
        <Text weight="medium" numberOfLines={1}>
          {item.description}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {categoryMeta(item.category).label}
          {item.notes ? ` · ${item.notes}` : ''}
        </Text>
      </View>
      <Money>{formatMoney(item.amount, currency)}</Money>
    </Pressable>
  );
}

export function KeyValueRow({ label, value, mono, tone }: { label: string; value: string; mono?: boolean; tone?: 'text' | 'muted' | 'positive' | 'negative' }) {
  return (
    <View style={styles.kv}>
      <Text tone="muted">{label}</Text>
      {mono ? <Money tone={tone ?? 'text'}>{value}</Money> : <Text tone={tone ?? 'text'} weight="medium">{value}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  catIcon: { alignItems: 'center', justifyContent: 'center' },
  dayHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingTop: 14, paddingBottom: 6 },
  caps: { letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12 },
  rowBody: { flex: 1, gap: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
});
