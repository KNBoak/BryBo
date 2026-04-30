import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ContactFormScreen } from '../../src/features/contacts/ContactFormScreen';

export default function NewContactPage() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>();
  return <ContactFormScreen prefillAccountId={accountId} />;
}
