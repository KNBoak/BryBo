import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EventFormScreen } from '../../src/features/events/EventFormScreen';

export default function NewEventPage() {
  const { date, accountId, contactId } = useLocalSearchParams<{
    date?: string;
    accountId?: string;
    contactId?: string;
  }>();
  return (
    <EventFormScreen
      prefillDate={date}
      prefillAccountId={accountId}
      prefillContactId={contactId}
    />
  );
}
