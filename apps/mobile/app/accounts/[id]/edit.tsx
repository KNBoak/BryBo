import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AccountFormScreen } from '../../../src/features/accounts/AccountFormScreen';

export default function EditAccountPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountFormScreen editId={id} />;
}
