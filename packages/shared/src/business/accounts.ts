import type { Event, EventAccount, Day } from '../types/entities';

export function isProspect(
  accountId: string,
  eventAccounts: EventAccount[],
  events: Event[],
): boolean {
  const linkedEventIds = new Set(
    eventAccounts.filter((ea) => ea.account_id === accountId).map((ea) => ea.event_id),
  );
  return !events.some(
    (e) =>
      linkedEventIds.has(e.id) &&
      !e.is_cancelled &&
      e.amount !== null &&
      e.amount > 0,
  );
}

export function getLastInteractionDate(
  accountId: string,
  eventAccounts: EventAccount[],
  events: Event[],
  days: Day[],
): string | null {
  const linkedEventIds = new Set(
    eventAccounts.filter((ea) => ea.account_id === accountId).map((ea) => ea.event_id),
  );
  const dayMap = new Map(days.map((d) => [d.id, d.date]));
  const dates = events
    .filter((e) => linkedEventIds.has(e.id) && !e.is_cancelled)
    .map((e) => dayMap.get(e.day_id))
    .filter((d): d is string => d !== undefined);
  if (dates.length === 0) return null;
  return dates.sort((a, b) => b.localeCompare(a))[0];
}

export function getTotalSpend(
  accountId: string,
  eventAccounts: EventAccount[],
  events: Event[],
): number {
  const linkedEventIds = new Set(
    eventAccounts.filter((ea) => ea.account_id === accountId).map((ea) => ea.event_id),
  );
  return events
    .filter((e) => linkedEventIds.has(e.id) && !e.is_cancelled && e.amount !== null)
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
