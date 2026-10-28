import { Check } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import type { GroupMember, SplitType } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { hapticSelect } from '@/utils/misc';
import { formatMoney, round2 } from '@/utils/money';
import type { SplitValidation } from '@/utils/split';
import { Avatar } from './Avatar';
import { Segmented } from './Chip';
import { Money, Text } from './Text';

export type SplitState = {
  type: SplitType;
  /** userId → entered value (equal: 0). Presence = included. */
  values: Record<string, number>;
  advanced: boolean;
};

export function SplitEditor({
  members,
  meId,
  state,
  onChange,
  result,
  currency,
  amount,
}: {
  members: GroupMember[];
  meId?: string;
  state: SplitState;
  onChange: (next: SplitState) => void;
  result: SplitValidation;
  currency: string;
  amount: number;
}) {
  const t = useTheme();
  const included = (id: string) => id in state.values;

  const toggleMember = (id: string) => {
    hapticSelect();
    const values = { ...state.values };
    if (id in values) {
      if (Object.keys(values).length === 1) return; // keep at least one
      delete values[id];
    } else {
      values[id] = state.type === 'shares' ? 1 : 0;
    }
    onChange({ ...state, values });
  };

  const setValue = (id: string, text: string) => {
    const cleaned = text.replace(/[^\d.]/g, '');
    const n = cleaned === '' ? 0 : Number(cleaned);
    onChange({ ...state, values: { ...state.values, [id]: Number.isFinite(n) ? n : 0 } });
  };

  const setType = (type: SplitType) => {
    const ids = Object.keys(state.values);
    const n = ids.length || 1;
    const values: Record<string, number> = {};
    for (const id of ids) {
      values[id] = type === 'exact' ? round2(amount / n) : type === 'percent' ? round2(100 / n) : type === 'shares' ? 1 : 0;
    }
    // fix drift so the editor starts balanced
    if ((type === 'exact' || type === 'percent') && ids.length > 0) {
      const target = type === 'exact' ? amount : 100;
      const sum = ids.reduce((s, id) => s + (values[id] ?? 0), 0);
      const first = ids[0]!;
      values[first] = round2((values[first] ?? 0) + (target - sum));
    }
    onChange({ ...state, type, values });
  };

  const toggleAdvanced = (v: boolean) => {
    hapticSelect();
    if (v) {
      // Start in "exact" with a balanced default so Save is immediately possible.
      const ids = Object.keys(state.values);
      const n = ids.length || 1;
      const values: Record<string, number> = {};
      for (const id of ids) values[id] = round2(amount / n);
      if (ids.length > 0) {
        const sum = ids.reduce((s, id) => s + (values[id] ?? 0), 0);
        const first = ids[0]!;
        values[first] = round2((values[first] ?? 0) + (amount - sum));
      }
      onChange({ advanced: true, type: 'exact', values });
    } else {
      onChange({ advanced: false, type: 'equal', values: Object.fromEntries(Object.keys(state.values).map((id) => [id, 0])) });
    }
  };

  const unit = state.type === 'percent' ? '%' : state.type === 'shares' ? 'sh' : '';
  const includedCount = Object.keys(state.values).length;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text variant="label" tone="muted">
            Split between
          </Text>
          <Text variant="small" tone="muted">
            {state.type === 'equal' ? `${includedCount} ${includedCount === 1 ? 'person' : 'people'} · equally` : `${includedCount} ${includedCount === 1 ? 'person' : 'people'} · ${state.type}`}
          </Text>
        </View>
        <View style={styles.advRow}>
          <Text variant="small" tone="muted">
            Advanced
          </Text>
          <Switch value={state.advanced} onValueChange={toggleAdvanced} trackColor={{ true: t.colors.accent, false: t.colors.border }} thumbColor="#FFFFFF" />
        </View>
      </View>

      {state.advanced ? (
        <Segmented<SplitType>
          value={state.type}
          onChange={setType}
          options={[
            { value: 'exact', label: 'Exact' },
            { value: 'percent', label: 'Percent' },
            { value: 'shares', label: 'Shares' },
          ]}
        />
      ) : null}

      <View style={[styles.list, { borderColor: t.colors.border, borderRadius: t.radii.control }]}>
        {members.map((m, i) => {
          const on = included(m.userId);
          const computed = result.splits.find((s) => s.userId === m.userId);
          return (
            <View key={m.userId} style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: t.colors.border }]}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggleMember(m.userId)}
                style={styles.rowMain}
              >
                <View style={[styles.check, { borderColor: on ? t.colors.accent : t.colors.border, backgroundColor: on ? t.colors.accent : 'transparent' }]}>
                  {on ? <Check size={14} color={t.colors.onAccent} strokeWidth={3} /> : null}
                </View>
                <Avatar name={m.name} color={m.avatarColor} size={28} />
                <Text numberOfLines={1} style={{ flex: 1 }} tone={on ? 'text' : 'muted'}>
                  {m.userId === meId ? 'You' : m.name}
                </Text>
              </Pressable>
              {on && state.advanced ? (
                <View style={[styles.valueBox, { backgroundColor: t.colors.surface2, borderRadius: 8 }]}>
                  <TextInput
                    value={formatValue(state.values[m.userId] ?? 0)}
                    onChangeText={(v) => setValue(m.userId, v)}
                    keyboardType={state.type === 'shares' ? 'number-pad' : 'decimal-pad'}
                    selectTextOnFocus
                    style={[styles.valueInput, { color: t.colors.text, fontFamily: t.fonts.mono }]}
                    maxLength={8}
                  />
                  {unit ? (
                    <Text variant="micro" tone="muted">
                      {unit}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              <Money variant="small" tone={on ? 'text' : 'muted'} style={styles.amountCol}>
                {on && computed ? formatMoney(computed.amount, currency) : '—'}
              </Money>
            </View>
          );
        })}
      </View>

      {state.advanced ? <RemainingIndicator result={result} type={state.type} currency={currency} /> : null}
    </View>
  );
}

function formatValue(n: number): string {
  if (!n) return '';
  return Number.isInteger(n) ? String(n) : String(round2(n));
}

function RemainingIndicator({ result, type, currency }: { result: SplitValidation; type: SplitType; currency: string }) {
  const t = useTheme();
  const ok = result.ok;
  let text: string;
  if (ok) {
    text = type === 'shares' ? 'Shares balanced' : 'All assigned';
  } else if (type === 'exact') {
    text = result.remaining > 0 ? `${formatMoney(result.remaining, currency)} remaining` : result.remaining < 0 ? `Over by ${formatMoney(-result.remaining, currency)}` : (result.message ?? '');
  } else if (type === 'percent') {
    text = result.remaining > 0 ? `${round2(result.remaining)}% left` : result.remaining < 0 ? `Over by ${round2(-result.remaining)}%` : (result.message ?? '');
  } else {
    text = result.message ?? 'Give at least one share.';
  }
  return (
    <View style={[styles.remaining, { backgroundColor: ok ? t.colors.positiveSoft : t.colors.negativeSoft, borderRadius: 10 }]}>
      <Text variant="small" weight="medium" tone={ok ? 'positive' : 'negative'}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  advRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  list: { borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  valueBox: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 2, minWidth: 72 },
  valueInput: { fontSize: 15, paddingVertical: 6, minWidth: 44, textAlign: 'right' },
  amountCol: { minWidth: 78, textAlign: 'right' },
  remaining: { paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
});
