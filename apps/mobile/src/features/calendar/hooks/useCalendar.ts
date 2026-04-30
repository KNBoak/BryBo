import { useMemo } from 'react';
import { useDataStore } from '../../../stores/dataStore';
import { today as getToday } from '@brybo/shared';

export interface CalendarCell {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  eventCount: number;
}

interface CalendarFilters {
  accountId?: string | null;
  contactId?: string | null;
  eventType?: string | null;
}

export function useCalendarMonth(
  year: number,
  month: number, // 1-based
  filters?: CalendarFilters,
): CalendarCell[] {
  const events = useDataStore((s) => s.events);
  const days = useDataStore((s) => s.days);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const eventContacts = useDataStore((s) => s.eventContacts);

  return useMemo(() => {
    const todayStr = getToday();

    // Build a map: date string -> event count (filtered)
    const dateEventCount = new Map<string, number>();

    let filteredEvents = events.filter((e) => !e.is_cancelled);

    if (filters?.accountId) {
      const accountEventIds = new Set(
        eventAccounts.filter((ea) => ea.account_id === filters.accountId).map((ea) => ea.event_id),
      );
      filteredEvents = filteredEvents.filter((e) => accountEventIds.has(e.id));
    }
    if (filters?.contactId) {
      const contactEventIds = new Set(
        eventContacts.filter((ec) => ec.contact_id === filters.contactId).map((ec) => ec.event_id),
      );
      filteredEvents = filteredEvents.filter((e) => contactEventIds.has(e.id));
    }
    if (filters?.eventType) {
      filteredEvents = filteredEvents.filter((e) => e.type === filters.eventType);
    }

    const dayMap = new Map(days.map((d) => [d.id, d.date]));
    for (const e of filteredEvents) {
      const date = dayMap.get(e.day_id);
      if (!date) continue;
      dateEventCount.set(date, (dateEventCount.get(date) ?? 0) + 1);
    }

    // Build grid
    const firstOfMonth = new Date(year, month - 1, 1);
    const startDow = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    const cells: CalendarCell[] = [];

    // Prev month fill
    for (let i = startDow - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      const prevMonth = month - 1 === 0 ? 12 : month - 1;
      const prevYear = month - 1 === 0 ? year - 1 : year;
      const date = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ date, dayOfMonth: day, isCurrentMonth: false, isToday: date === todayStr, eventCount: dateEventCount.get(date) ?? 0 });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, dayOfMonth: d, isCurrentMonth: true, isToday: date === todayStr, eventCount: dateEventCount.get(date) ?? 0 });
    }

    // Next month fill to complete 6-row grid
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = month + 1 === 13 ? 1 : month + 1;
      const nextYear = month + 1 === 13 ? year + 1 : year;
      const date = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, dayOfMonth: d, isCurrentMonth: false, isToday: date === todayStr, eventCount: dateEventCount.get(date) ?? 0 });
    }

    return cells;
  }, [events, days, eventAccounts, eventContacts, year, month, filters?.accountId, filters?.contactId, filters?.eventType]);
}
