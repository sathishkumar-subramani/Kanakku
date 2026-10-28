import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import { errorMessage } from '@/api';
import { useExpense, useGroup, useMe } from '@/api/queries';
import { Card } from '@/components/Card';
import { ExpenseForm } from '@/components/ExpenseForm';
import { Header, Screen } from '@/components/Screen';
import { ErrorState, SkeletonRows } from '@/components/States';

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exp = useExpense(id);
  const group = useGroup(exp.data?.groupId);
  const me = useMe();
  const ready = !!exp.data && !!group.data && !!me.data;

  return (
    <Screen keyboard header={<Header title="Edit expense" subtitle={group.data ? `${group.data.emoji} ${group.data.name}` : undefined} />}>
      {exp.isError ? (
        <ErrorState message={errorMessage(exp.error)} onRetry={() => exp.refetch()} />
      ) : group.isError ? (
        <ErrorState message={errorMessage(group.error)} onRetry={() => group.refetch()} />
      ) : !ready ? (
        <Card>
          <SkeletonRows rows={4} />
        </Card>
      ) : (
        <ExpenseForm key={exp.data!.id} group={group.data!} meId={me.data!.id} existing={exp.data!} />
      )}
    </Screen>
  );
}
