import { ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PAYMENT_APPS, type ParsedTxn } from '@/capture/parser';
import { useTheme } from '@/theme/ThemeProvider';

export function DirIcon({ direction, size = 34 }: { direction: 'debit' | 'credit'; size?: number }) {
  const t = useTheme();
  const debit = direction === 'debit';
  return (
    <View style={[styles.dir, { width: size, height: size, borderRadius: size / 2, backgroundColor: debit ? t.colors.negativeSoft : t.colors.positiveSoft }]}>
      {debit ? <ArrowUpRight size={size * 0.53} color={t.colors.negative} /> : <ArrowDownLeft size={size * 0.53} color={t.colors.positive} />}
    </View>
  );
}

export function sourceLabel(item: Pick<ParsedTxn, 'source' | 'sender' | 'senderKey'>): string {
  if (item.source === 'notification') return PAYMENT_APPS[item.sender] ?? 'UPI app';
  return `SMS · ${item.senderKey}`;
}

export function timeLabel(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

const styles = StyleSheet.create({
  dir: { alignItems: 'center', justifyContent: 'center' },
});
