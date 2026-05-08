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

export interface Account {
  id: string;
  user_id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  is_prospect: boolean;
  created_at: string;
  updated_at: string;
}

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

export interface Event {
  id: string;
  user_id: string;
  day_id: string;
  type: string; // EventTypePrimary | freeform string
  status: 'todo' | 'done';
  notes: string | null;
  amount: number | null; // only for sale/revenue events
  is_cancelled: boolean;
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
