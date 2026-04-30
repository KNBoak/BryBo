import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AccountDetailScreen } from '../../src/features/accounts/AccountDetailScreen';

export default function AccountDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountDetailScreen id={id} />;
}
