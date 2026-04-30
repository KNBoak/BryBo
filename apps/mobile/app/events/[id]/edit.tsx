import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EventFormScreen } from '../../../src/features/events/EventFormScreen';

export default function EditEventPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventFormScreen editId={id} />;
}
