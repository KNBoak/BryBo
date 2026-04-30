import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { EventDetailScreen } from '../../src/features/events/EventDetailScreen';

export default function EventDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventDetailScreen id={id} />;
}
