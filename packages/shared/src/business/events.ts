import type { Event, Day } from '../types/entities';
import { SALE_EVENT_TYPES } from '../types/entities';
import { today } from './days';

export function isSaleEvent(event: Event): boolean {
  return event.amount !== null && event.amount > 0;
}

export function isPastEvent(event: Event, days: Day[]): boolean {
  const day = days.find((d) => d.id === event.day_id);
  if (!day) return false;
  return day.date < today();
}

export function isFutureEvent(event: Event, days: Day[]): boolean {
  const day = days.find((d) => d.id === event.day_id);
  if (!day) return false;
  return day.date > today();
}

export function isTodayEvent(event: Event, days: Day[]): boolean {
  const day = days.find((d) => d.id === event.day_id);
  if (!day) return false;
  return day.date === today();
}

export function shouldShowAmountByDefault(eventType: string): boolean {
  return (SALE_EVENT_TYPES as readonly string[]).includes(eventType);
}

export function getEventDayDate(event: Event, days: Day[]): string | null {
  return days.find((d) => d.id === event.day_id)?.date ?? null;
}

export function formatEventType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
