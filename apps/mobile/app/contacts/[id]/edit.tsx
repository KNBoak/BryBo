import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ContactFormScreen } from '../../../src/features/contacts/ContactFormScreen';

export default function EditContactPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ContactFormScreen editId={id} />;
}
