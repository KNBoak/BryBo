export interface User {
  id: string;
  name: string;
  color?: string;
  created_at: string;
}

export type NonWorkingReason = 'holiday' | 'vacation' | 'sick' | 'personal' | 'weekend' | 'other';

export interface Day {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD, unique per user
  notes: string | null;
  // Tri-state with weekend fallback when undefined:
  //   true  → explicitly marked working (overrides weekend default)
  //   false → not working
  //   undefined → treat Sat/Sun as non-working, all other dates as working
  is_working_day?: boolean;
  // Optional reason for non-working days (vacation, holiday, etc.).
  non_working_reason?: NonWorkingReason;
  created_at: string;
  updated_at: string;
}

/**
 * A labeled mailing/site address attached to an Account. An account can have
 * multiple (e.g., "Head office", "Warehouse"). Addresses are stored inline
 * on the Account record (not a separate join table).
 */
export interface AccountAddress {
  id: string;
  /** Freeform identifier shown next to the address. e.g., "Head office". */
  label: string | null;
  /** Full address as a single human-readable string. */
  address: string;
  is_primary: boolean;
  /** Optional geocoded coordinates (set when picked from a map suggestion). */
  latitude: number | null;
  longitude: number | null;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  city: string | null;
  state: string | null;
  addresses: AccountAddress[];
  phone: string | null;
  website: string | null;
  notes: string | null;
  is_prospect: boolean;
  /** Archived accounts are hidden from the main/prospect lists. */
  is_archived: boolean;
  /** Priority tier; null when unassigned. */
  level: AccountLevel | null;
  /** ID of the contact marked as primary for this account; null if none. */
  primary_contact_id: string | null;
  created_at: string;
  updated_at: string;
}

export type AccountLevel = 'A' | 'B' | 'C';

export interface Contact {
  id: string;
  user_id: string;
  account_id: string | null;
  first_name: string;
  last_name: string;
  title: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ContactMethodType = 'cell' | 'email' | 'work' | 'home' | 'other';

export interface ContactMethod {
  id: string;
  contact_id: string;
  type: ContactMethodType;
  value: string;
  label: string | null;
  is_primary: boolean;
}

export type EventTypePrimary = 'call' | 'email' | 'text' | 'visit' | 'demo' | 'meeting' | 'other';

export const EVENT_TYPES: EventTypePrimary[] = [
  'call',
  'email',
  'text',
  'visit',
  'demo',
  'meeting',
  'other',
];

export const SALE_EVENT_TYPES: EventTypePrimary[] = ['visit', 'demo', 'meeting'];

export type EventKind = 'note' | 'task';

export interface Event {
  id: string;
  user_id: string;
  day_id: string;
  type: string; // EventTypePrimary | freeform string
  /**
   * 'note' → record-keeping entry, no checkbox/strikethrough.
   * 'task' → completable, shows checkbox and done strikethrough.
   */
  kind: EventKind;
  status: 'todo' | 'done';
  notes: string | null;
  amount: number | null; // only for sale/revenue events
  is_cancelled: boolean;
  /** ID of the event this one was created as a follow-up of, or null. */
  source_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventAccount {
  event_id: string;
  account_id: string;
}

export interface EventContact {
  event_id: string;
  contact_id: string;
}
