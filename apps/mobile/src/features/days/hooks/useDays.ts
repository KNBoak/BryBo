import { useMemo } from 'react';
import { useDataStore } from '../../../stores/dataStore';
import type { Event } from '@brybo/shared';

export function useDay(date: string) {
  const days = useDataStore((s) => s.days);
  return useMemo(() => days.find((d) => d.date === date) ?? null, [days, date]);
}

export function useEventsForDate(date: string): Event[] {
  const day = useDay(date);
  const events = useDataStore((s) => s.events);
  return useMemo(() => {
    if (!day) return [];
    return events.filter((e) => e.day_id === day.id);
  }, [day, events]);
}

export function useDaySummary(date: string) {
  const events = useEventsForDate(date);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const eventContacts = useDataStore((s) => s.eventContacts);

  return useMemo(() => {
    const activeEvents = events.filter((e) => !e.is_cancelled);
    const eventIds = new Set(activeEvents.map((e) => e.id));
    const uniqueAccountIds = new Set(
      eventAccounts.filter((ea) => eventIds.has(ea.event_id)).map((ea) => ea.account_id),
    );
    const uniqueContactIds = new Set(
      eventContacts.filter((ec) => eventIds.has(ec.event_id)).map((ec) => ec.contact_id),
    );
    const totalSales = activeEvents.reduce((sum, e) => sum + (e.amount ?? 0), 0);
    return {
      accountCount: uniqueAccountIds.size,
      contactCount: uniqueContactIds.size,
      totalSales,
      eventCount: activeEvents.length,
    };
  }, [events, eventAccounts, eventContacts]);
}
