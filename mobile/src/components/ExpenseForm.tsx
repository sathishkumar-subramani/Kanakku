import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { errorMessage } from '@/api';
import { useCreateExpense, useDeleteExpense, useUpdateExpense } from '@/api/queries';
import type { Category, Expense, ExpenseInput, Group } from '@/api/types';
import { useTheme } from '@/theme/ThemeProvider';
import { todayString } from '@/utils/dates';
import { hapticError, hapticSuccess } from '@/utils/misc';
import { parseAmount, round2 } from '@/utils/money';
import { computeSplits, toSplitInputs } from '@/utils/split';
import { AmountInput } from './AmountInput';
import { Button } from './Button';
import { Card } from './Card';
import { CategoryGrid } from './Chip';
import { DateField } from './DateField';
import { Input } from './Input';
import { MemberPicker } from './MemberPicker';
import { SplitEditor, type SplitState } from './SplitEditor';
import { Text } from './Text';

export function ExpenseForm({ group, meId, existing }: { group: Group; meId: string; existing?: Expense }) {
  const t = useTheme();
  const router = useRouter();
  const create = useCreateExpense(group.id);
  const update = useUpdateExpense(group.id);
  const del = useDeleteExpense(group.id);

  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'food');
  const [date, setDate] = useState(existing?.date?.slice(0, 10) ?? todayString());
  const [paidBy, setPaidBy] = useState(existing?.paidBy.id ?? meId);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [split, setSplit] = useState<SplitState>(() => {
    if (existing) {
      const values: Record<string, number> = {};
      for (const s of existing.splits) values[s.userId] = existing.splitType === 'equal' ? 0 : s.value;
      // Members who have since left stay in the split only if still in the group.
      const memberIds = new Set(group.members.map((m) => m.userId));
      for (const id of Object.keys(values)) if (!memberIds.has(id)) delete values[id];
      return { type: existing.splitType, values, advanced: existing.splitType !== 'equal' };
    }
    return { type: 'equal', values: Object.fromEntries(group.members.map((m) => [m.userId, 0])), advanced: false };
  });
  const [errors, setErrors] = useState<{ description?: string; amount?: string }>({});

  const amountNum = parseAmount(amount);
  const result = useMemo(() => computeSplits(split.type, Number.isFinite(amountNum) ? round2(amountNum) : 0, split.values, paidBy), [split, amountNum, paidBy]);
  const canSave = description.trim().length > 0 && amountNum > 0 && result.ok;
  const busy = create.isPending || update.isPending;

  const save = async () => {
    const e: typeof errors = {};
    if (!description.trim()) e.description = 'What was this for?';
    if (!(amountNum > 0)) e.amount = 'Enter an amount greater than 0.';
    setErrors(e);
    if (Object.keys(e).length > 0 || !result.ok) return;

    const body: ExpenseInput = {
      description: description.trim(),
      amount: round2(amountNum),
      category,
      date,
      notes: notes.trim() || undefined,
      paidBy,
      splitType: split.type,
      splits: toSplitInputs(split.type, result.splits),
    };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, body });
      else await create.mutateAsync(body);
      hapticSuccess();
      if (router.canGoBack()) router.back();
      else router.replace(`/group/${group.id}`);
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save", errorMessage(err));
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert('Delete this expense?', `"${existing.description}" will be removed for everyone in ${group.name}.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(existing.id);
            hapticSuccess();
            router.dismissTo(`/group/${group.id}`);
          } catch (err) {
            hapticError();
            Alert.alert("Couldn't delete", errorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 14 }}>
        <Input
          label="Description"
          value={description}
          onChangeText={(v) => {
            setDescription(v);
            if (errors.description) setErrors((p) => ({ ...p, description: undefined }));
          }}
          placeholder="e.g. Groceries, Dinner at Murugan"
          maxLength={80}
          autoFocus={!existing}
          error={errors.description}
          returnKeyType="next"
        />
        <AmountInput
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            if (errors.amount) setErrors((p) => ({ ...p, amount: undefined }));
          }}
          currency={group.currency}
          label="Amount"
          error={errors.amount}
        />
        <View>
          <Text variant="label" tone="muted" style={{ marginBottom: 8 }}>
            Category
          </Text>
          <CategoryGrid value={category} onChange={setCategory} />
        </View>
        <DateField value={date} onChange={setDate} />
      </Card>

      <Card style={{ gap: 14 }}>
        <MemberPicker label="Who paid?" members={group.members} value={paidBy} onChange={setPaidBy} meId={meId} />
        <SplitEditor members={group.members} meId={meId} state={split} onChange={setSplit} result={result} currency={group.currency} amount={Number.isFinite(amountNum) ? round2(amountNum) : 0} />
      </Card>

      <Card>
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything worth remembering" multiline numberOfLines={3} maxLength={300} style={{ minHeight: 70, textAlignVertical: 'top' }} />
      </Card>

      <Button title={existing ? 'Save changes' : 'Save expense'} size="lg" onPress={save} disabled={!canSave} loading={busy} fullWidth />
      {!result.ok && amountNum > 0 && Object.keys(split.values).length > 0 && split.advanced ? (
        <Text variant="small" tone="muted" center>
          Balance the split to enable Save.
        </Text>
      ) : null}
      {existing ? <Button title="Delete expense" variant="danger" onPress={confirmDelete} loading={del.isPending} fullWidth /> : null}
      <View style={{ height: 8, backgroundColor: t.colors.bg }} />
    </View>
  );
}

