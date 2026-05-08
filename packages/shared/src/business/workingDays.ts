import type { Day } from '../types/entities';

export type WorkingDayLookup = (date: string) => boolean;

/**
 * Tri-state working-day check:
 *   - is_working_day === true  → explicit override, always working
 *   - is_working_day === false → not working
 *   - undefined or no record   → weekend (Sat/Sun) defaults to not working
 *
 * `dayRecord` is the existing Day for that date if any.
 */
export function isWorkingDay(date: string, dayRecord: Pick<Day, 'is_working_day'> | undefined): boolean {
  if (dayRecord?.is_working_day === true) return true;
  if (dayRecord?.is_working_day === false) return false;
  return !isWeekend(date);
}

export function isWeekend(date: string): boolean {
  const d = new Date(date + 'T00:00:00');
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

export function buildWorkingDayLookup(days: Day[]): WorkingDayLookup {
  const byDate = new Map<string, Day>();
  for (const d of days) byDate.set(d.date, d);
  return (date: string) => isWorkingDay(date, byDate.get(date));
}

function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function toIso(year: number, monthZeroBased: number, day: number): string {
  const m = String(monthZeroBased + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${m}-${dd}`;
}

export function addDays(startDate: string, days: number): string {
  const { y, m, d } = parseIsoDate(startDate);
  const dt = new Date(y, m - 1, d + days);
  return toIso(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function addMonths(startDate: string, months: number): string {
  const { y, m, d } = parseIsoDate(startDate);
  // Clamp to last day of target month — Jan 31 + 1mo => Feb 28/29.
  const targetMonth = m - 1 + months;
  const targetYear = y + Math.floor(targetMonth / 12);
  const wrappedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, wrappedMonth + 1, 0).getDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  return toIso(targetYear, wrappedMonth, clampedDay);
}

export interface OffsetResult {
  rawTarget: string;
  resolved: string;
  wasAdjusted: boolean;
}

export function addWorkingDayOffset(
  startDate: string,
  unit: 'week' | 'month',
  count: number,
  isWorking: WorkingDayLookup,
): OffsetResult {
  const rawTarget = unit === 'week'
    ? addDays(startDate, count * 7)
    : addMonths(startDate, count);

  let resolved = rawTarget;
  let safety = 0;
  while (!isWorking(resolved)) {
    resolved = addDays(resolved, 1);
    if (++safety > 365) break;
  }

  return { rawTarget, resolved, wasAdjusted: resolved !== rawTarget };
}

export function formatRelative(targetDate: string, today: string): string {
  const ms = new Date(targetDate + 'T00:00:00').getTime() -
    new Date(today + 'T00:00:00').getTime();
  const days = Math.round(ms / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}
