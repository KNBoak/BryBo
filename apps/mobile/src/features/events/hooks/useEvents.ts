import { useMemo } from 'react';
import { useDataStore } from '../../../stores/dataStore';
import type { Event } from '@brybo/shared';

export function useEventsForDay(dayId: string): Event[] {
  const events = useDataStore((s) => s.events);
  return useMemo(
    () => events.filter((e) => e.day_id === dayId),
    [events, dayId],
  );
}

export function useEventsForAccount(accountId: string): Event[] {
  const events = useDataStore((s) => s.events);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  return useMemo(() => {
    const ids = new Set(
      eventAccounts.filter((ea) => ea.account_id === accountId).map((ea) => ea.event_id),
    );
    return events.filter((e) => ids.has(e.id));
  }, [events, eventAccounts, accountId]);
}

export function useEventsForContact(contactId: string): Event[] {
  const events = useDataStore((s) => s.events);
  const eventContacts = useDataStore((s) => s.eventContacts);
  return useMemo(() => {
    const ids = new Set(
      eventContacts.filter((ec) => ec.contact_id === contactId).map((ec) => ec.event_id),
    );
    return events.filter((e) => ids.has(e.id));
  }, [events, eventContacts, contactId]);
}
