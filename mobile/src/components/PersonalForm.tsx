import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, View } from 'react-native';

import { errorMessage } from '@/api';
import { useCreatePersonal, useDeletePersonal, useUpdatePersonal } from '@/api/queries';
import type { Category, PersonalExpense, PersonalExpenseInput } from '@/api/types';
import { todayString } from '@/utils/dates';
import { hapticError, hapticSuccess } from '@/utils/misc';
import { parseAmount, round2 } from '@/utils/money';
import { AmountInput } from './AmountInput';
import { Button } from './Button';
import { Card } from './Card';
import { CategoryGrid } from './Chip';
import { DateField } from './DateField';
import { Input } from './Input';
import { Text } from './Text';

export function PersonalForm({ currency, existing }: { currency: string; existing?: PersonalExpense }) {
  const router = useRouter();
  const create = useCreatePersonal();
  const update = useUpdatePersonal();
  const del = useDeletePersonal();

  const [description, setDescription] = useState(existing?.description ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'food');
  const [date, setDate] = useState(existing?.date?.slice(0, 10) ?? todayString());
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [errors, setErrors] = useState<{ description?: string; amount?: string }>({});

  const n = parseAmount(amount);
  const canSave = description.trim().length > 0 && n > 0;
  const busy = create.isPending || update.isPending;

  const save = async () => {
    const e: typeof errors = {};
    if (!description.trim()) e.description = 'What was this for?';
    if (!(n > 0)) e.amount = 'Enter an amount greater than 0.';
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const body: PersonalExpenseInput = {
      description: description.trim(),
      amount: round2(n),
      category,
      date,
      notes: notes.trim() || undefined,
    };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, body });
      else await create.mutateAsync(body);
      hapticSuccess();
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/personal');
    } catch (err) {
      hapticError();
      Alert.alert("Couldn't save", errorMessage(err));
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert('Delete this expense?', `"${existing.description}" will be removed.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await del.mutateAsync(existing.id);
            hapticSuccess();
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/personal');
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
          placeholder="e.g. Auto to office, Haircut"
          maxLength={80}
          autoFocus={!existing}
          error={errors.description}
        />
        <AmountInput
          value={amount}
          onChangeText={(v) => {
            setAmount(v);
            if (errors.amount) setErrors((p) => ({ ...p, amount: undefined }));
          }}
          currency={currency}
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
        <Input label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Anything worth remembering" multiline maxLength={300} style={{ minHeight: 60, textAlignVertical: 'top' }} />
      </Card>
      <Button title={existing ? 'Save changes' : 'Save expense'} size="lg" onPress={save} disabled={!canSave} loading={busy} fullWidth />
      {existing ? <Button title="Delete expense" variant="danger" onPress={confirmDelete} loading={del.isPending} fullWidth /> : null}
    </View>
  );
}
