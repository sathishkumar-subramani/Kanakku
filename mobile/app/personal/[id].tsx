import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';

import { useMe, usePersonal } from '@/api/queries';
import type { PersonalExpense } from '@/api/types';
import { Card } from '@/components/Card';
import { PersonalForm } from '@/components/PersonalForm';
import { Header, Screen } from '@/components/Screen';
import { EmptyState, SkeletonRows } from '@/components/States';

/**
 * Personal expense edit sheet. The API has no GET /personal/{id}, so we look the item up in
 * any cached month list (or the all-time list as a fallback).
 */
export default function PersonalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const qc = useQueryClient();
  const cached = useMemo(() => {
    for (const [, data] of qc.getQueriesData<PersonalExpense[]>({ queryKey: ['personal'] })) {
      const hit = data?.find((p) => p.id === id);
      if (hit) return hit;
    }
    // dashboard.recent flattens personal items with groupId "personal"
    for (const [, data] of qc.getQueriesData<{ recent?: { id: string; groupId: string; description: string; amount: number; category: PersonalExpense['category']; date: string; notes: string | null; createdAt: string; updatedAt: string }[] }>({ queryKey: ['dashboard'] })) {
      const hit = data?.recent?.find((p) => p.id === id && p.groupId === 'personal');
      if (hit) return { id: hit.id, description: hit.description, amount: hit.amount, category: hit.category, date: hit.date, notes: hit.notes, createdAt: hit.createdAt, updatedAt: hit.updatedAt } satisfies PersonalExpense;
    }
    return undefined;
  }, [qc, id]);
  const all = usePersonal(undefined);
  const item = cached ?? all.data?.find((p) => p.id === id);

  return (
    <Screen keyboard header={<Header title="Edit personal expense" />}>
      {item ? (
        <PersonalForm key={item.id} currency={me.data?.currency ?? 'INR'} existing={item} />
      ) : all.isLoading ? (
        <Card>
          <SkeletonRows rows={3} />
        </Card>
      ) : (
        <Card>
          <EmptyState emoji="🔍" title="Expense not found" body="It may have been deleted." compact />
        </Card>
      )}
    </Screen>
  );
}
