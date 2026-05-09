/**
 * Cutoff for displaying events.
 *
 * Events dated before this YYYY-MM-DD are treated as historical seed data
 * and are filtered out of:
 *   - the daily log
 *   - last-touch / next-event computations on the account & contact lists
 *   - the upcoming/past event lists on AccountDetailModal & ContactDetailModal
 *
 * Yearly sales totals on AccountDetailModal intentionally bypass this filter
 * (they aggregate across the full event history).
 */
export const EVENT_DISPLAY_CUTOFF = '2026-05-01';

/**
 * Returns true when an event's day-date is at or after the display cutoff.
 * Pass the event's day's `date` field (YYYY-MM-DD).
 */
export function isVisibleEventDate(date: string): boolean {
  return date >= EVENT_DISPLAY_CUTOFF;
}
