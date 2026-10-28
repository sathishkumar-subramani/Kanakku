import React from 'react';

import { useMe } from '@/api/queries';
import { PersonalForm } from '@/components/PersonalForm';
import { Header, Screen } from '@/components/Screen';

export default function NewPersonalScreen() {
  const me = useMe();
  return (
    <Screen keyboard header={<Header title="Add personal expense" subtitle="Only you will see this." />}>
      <PersonalForm currency={me.data?.currency ?? 'INR'} />
    </Screen>
  );
}
