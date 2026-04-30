import type { Day } from '../types/entities';
import type { StorageAdapter } from '../storage/StorageAdapter';

export async function ensureDayExists(
  userId: string,
  date: string,
  storage: StorageAdapter,
): Promise<Day> {
  const existing = await storage.getDayByDate(userId, date);
  if (existing.ok && existing.data !== null) {
    return existing.data;
  }

  const now = new Date().toISOString();
  const day: Day = {
    id: crypto.randomUUID(),
    user_id: userId,
    date,
    notes: null,
    created_at: now,
    updated_at: now,
  };

  const saved = await storage.saveDay(day);
  if (!saved.ok) {
    throw new Error(`Failed to create day record: ${saved.error}`);
  }
  return saved.data;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
