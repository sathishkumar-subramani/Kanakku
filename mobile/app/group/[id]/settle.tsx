import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDownUp } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api';
import { useBalances, useCreateSettlement, useGroup, useMe } from '@/api/queries';
import { AmountInput } from '@/components/AmountInput';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { DateField } from '@/components/DateField';
import { Input } from '@/components/Input';
import { MemberPicker } from '@/components/MemberPicker';
import { Header, Screen } from '@/components/Screen';
import { Skeleton } from '@/components/States';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { todayString } from '@/utils/dates';
import { firstName, hapticError, hapticSelect, hapticSuccess } from '@/utils/misc';
import { formatMoney, parseAmount, round2 } from '@/utils/money';

export default function SettleUpScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; from?: string; to?: string; amount?: string }>();
  const group = useGroup(params.id);
  const balances = useBalances(params.id);
  const me = useMe();
  const create = useCreateSettlement(params.id);
  const g = group.data;
  const meId = me.data?.id;

  const [from, setFrom] = useState(params.from ?? '');
  const [to, setTo] = useState(params.to ?? '');
  const [amount, setAmount] = useState(params.amount ? String(round2(Number(params.amount))) : '');
  const [date, setDate] = useState(todayString());
  const [note, setNote] = useState('');
  const [seeded, setSeeded] = useState(false);

  // Default: me → the person I owe the most (or first other member).
  useEffect(() => {
    if (!g || !meId || seeded) return;
    setSeeded(true);
    if (!from) setFrom(meId);
    if (!to) {
      const myDebt = balances.data?.debts.find((d) => d.fromUserId === meId);
      const other = myDebt?.toUserId ?? g.members.find((m) => m.userId !== meId)?.userId ?? '';
      setTo(other);
      if (myDebt && !amount) setAmount(String(round2(myDebt.amount)));
    }
  }, [g, meId, seeded, from, to, amount, balances.data]);

  const swap = () => {
    hapticSelect();
    setFrom(to);
    setTo(from);
  };

  const n = parseAmount(amount);
  const suggested = balances.data?.debts.find((d) => d.fromUserId === from && d.toUserId === to)?.amount;
  const valid = !!from && !!to && from !== to && n > 0;

  const save = async () => {
    if (!valid) return;
    try {
      await create.mutateAsync({ fromUserId: from, toUserId: to, amount: round2(n), date, note: note.trim() || undefined });
      hapticSuccess();
      router.back();
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't record the payment", errorMessage(err));
    }
  };

  const fromName = g?.members.find((m) => m.userId === from)?.name;
  const toName = g?.members.find((m) => m.userId === to)?.name;

  return (
    <Screen keyboard header={<Header title="Settle up" subtitle={g ? `Record a payment in ${g.name}` : undefined} />}>
      {!g ? (
        <Card>
          <Skeleton width="60%" height={18} />
        </Card>
      ) : (
        <View style={{ gap: 14 }}>
          <Card style={{ gap: 14 }}>
            <MemberPicker label="Who paid" members={g.members} value={from} onChange={setFrom} meId={meId} />
            <View style={styles.swapRow}>
              <View style={[styles.line, { backgroundColor: t.colors.border }]} />
              <Pressable accessibilityRole="button" accessibilityLabel="Swap" onPress={swap} style={[styles.swapBtn, { backgroundColor: t.colors.surface2, borderColor: t.colors.border }]}>
                <ArrowDownUp size={16} color={t.colors.text} />
              </Pressable>
              <View style={[styles.line, { backgroundColor: t.colors.border }]} />
            </View>
            <MemberPicker label="Paid to" members={g.members} value={to} onChange={setTo} meId={meId} />
            {from && to && from === to ? (
              <Text variant="small" tone="negative">
                Pick two different people.
              </Text>
            ) : null}
          </Card>

          <Card style={{ gap: 14 }}>
            <AmountInput value={amount} onChangeText={setAmount} currency={g.currency} label="Amount" autoFocus={!params.amount} />
            {suggested && Math.abs(suggested - n) > 0.004 ? (
              <Pressable onPress={() => setAmount(String(round2(suggested)))}>
                <Text variant="small" tone="accent" weight="medium">
                  {firstName(fromName ?? '')} owes {firstName(toName ?? '')} {formatMoney(suggested, g.currency)} · use that
                </Text>
              </Pressable>
            ) : null}
            <DateField value={date} onChange={setDate} />
            <Input label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. GPay, cash" maxLength={80} />
          </Card>

          <Button title="Record payment" size="lg" onPress={save} disabled={!valid} loading={create.isPending} fullWidth />
          <Text variant="small" tone="muted" center>
            {fromName && toName && valid ? `${firstName(fromName)} paid ${firstName(toName)} ${formatMoney(n, g.currency)}.` : 'This reduces what the payer owes.'}
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1 },
  swapBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
