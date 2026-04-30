import type { EventContact, Event, Day } from '../types/entities';
import { today } from './days';

export function getContactLastInteractionDate(
  contactId: string,
  eventContacts: EventContact[],
  events: Event[],
  days: Day[],
): string | null {
  const linkedEventIds = new Set(
    eventContacts.filter((ec) => ec.contact_id === contactId).map((ec) => ec.event_id),
  );
  const dayMap = new Map(days.map((d) => [d.id, d.date]));
  const dates = events
    .filter((e) => linkedEventIds.has(e.id) && !e.is_cancelled)
    .map((e) => dayMap.get(e.day_id))
    .filter((d): d is string => d !== undefined);
  if (dates.length === 0) return null;
  return dates.sort((a, b) => b.localeCompare(a))[0];
}

export function getContactNextEvent(
  contactId: string,
  eventContacts: EventContact[],
  events: Event[],
  days: Day[],
): Event | null {
  const linkedEventIds = new Set(
    eventContacts.filter((ec) => ec.contact_id === contactId).map((ec) => ec.event_id),
  );
  const dayMap = new Map(days.map((d) => [d.id, d.date]));
  const todayStr = today();
  const future = events
    .filter(
      (e) => linkedEventIds.has(e.id) && !e.is_cancelled && (dayMap.get(e.day_id) ?? '') >= todayStr,
    )
    .sort((a, b) => (dayMap.get(a.day_id) ?? '').localeCompare(dayMap.get(b.day_id) ?? ''));
  return future[0] ?? null;
}

export function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
