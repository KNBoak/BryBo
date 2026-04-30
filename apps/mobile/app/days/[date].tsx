import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { DayDetailScreen } from '../../src/features/days/DayDetailScreen';

export default function DayDetailPage() {
  const { date } = useLocalSearchParams<{ date: string }>();
  return <DayDetailScreen date={date} />;
}
