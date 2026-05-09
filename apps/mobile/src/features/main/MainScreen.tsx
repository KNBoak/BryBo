/**
 * MainScreen — single-screen CRM
 *
 * This is the primary screen. Everything else (calendar, account/contact
 * detail forms, etc.) opens as a modal on top of this screen.
 *
 * ──────────────────────────────────────────────────────────────────
 * FOR CLAUDE CODE — INTEGRATION NOTES
 * ──────────────────────────────────────────────────────────────────
 * This file is self-contained: it defines its own types and uses local
 * useState for all data. Wire it into the app like this:
 *
 * 1. Replace the mock data block (search "MOCK DATA") with reads from
 *    useDataStore. The Profile, Account, Contact, and LogEntry types
 *    map to your existing User, Account, Contact, and Event types.
 *
 *    LogEntry maps to Event:
 *      - LogEntry.time      → Event.event_time (time only, nullable)
 *      - LogEntry.text      → Event.notes
 *      - LogEntry.amount    → Event.amount (sale events only)
 *      - LogEntry.accounts  → join via event_participants (account_id rows)
 *      - LogEntry.contacts  → join via event_participants (contact_id rows)
 *
 *    Note: the old single `day.notes` field is deprecated by this design.
 *    Each row is now an Event of type 'note' (or 'sale' if amount is set).
 *
 * 2. Replace mock handlers (saveLogEntry, deleteLogEntry, addProfile,
 *    switchProfile, etc.) with calls to the store.
 *
 * 3. Build out the stubbed modals as separate files in the same folder:
 *      - CalendarModal.tsx       (date picker — currently stub)
 *      - AccountDetailModal.tsx  (also handles "add" when isNew=true)
 *      - ContactDetailModal.tsx  (also handles "add" when isNew=true)
 *    The current inline modal stubs show what data each receives and
 *    what they should do.
 *
 * 4. The AI section calls a stub generator. Replace generateAiSummary()
 *    with a real call. The button label/sub varies by date and time
 *    (see modeForDate()) — keep that logic.
 *
 * 5. Validation rule: if a log entry has an amount (i.e. it's a sale),
 *    it must have exactly one linked account. Enforced in handleSave().
 *
 * 6. Sorting rule: log entries with a time sort first by time ascending;
 *    entries without a time sort at the bottom by id.
 *
 * 7. Tapping an account or contact name (in the log action sheet, or in
 *    the accounts/contacts list modal) should open the detail modal.
 *    The detail modal is the same component used for "add" (just empty
 *    when adding).
 *
 * 8. The calendar icon in the header opens a date picker. When viewing
 *    a non-today date, a "Today" pill appears in the header to jump back.
 *
 * 9. Profile add: the "+ New" item in the profile dropdown swaps inline
 *    to a text input with confirm/cancel. No separate modal.
 *
 * 10. All tappable account/contact references throughout the UI should
 *     route to the same detail modal — single source of truth.
 * ──────────────────────────────────────────────────────────────────
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { Button, RowActionsSheet, type RowAction, type RowActionGroup } from '../../components/ui';
import { useDataStore } from '../../stores/dataStore';
import { generateId } from '../../utils/ids';
import { logInfo, logError } from '../../utils/debug';
import { colorForUser, nextProfileColor } from '../../utils/profileColors';
import type { User, Event as StoreEvent, Day as StoreDay } from '@brybo/shared';
import { today as todayIso } from '@brybo/shared';
import { AccountDetailModal } from './AccountDetailModal';
import { ContactDetailModal } from './ContactDetailModal';
import { CalendarModal } from './CalendarModal';
import { ImportContactsModal } from './ImportContactsModal';
import { AiSettingsModal } from './AiSettingsModal';
import { EventFormModal, type EventFormInitial } from './EventFormModal';
import { FollowUpModal, type FollowUpSource } from './FollowUpModal';
import { MoveEventModal, type MoveEventSource } from './MoveEventModal';
import { buildDayContext } from './aiContext';
import { runAiAssist, AiAuthError, AiRateLimitError, AiNetworkError, AiServerError } from './aiCall';
import { getApiKey } from '../../utils/apiKeyStore';
import { isVisibleEventDate } from '../../utils/dateCutoff';

const TAG = 'MainScreen';

// ──────────────────────────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  name: string;
  color: string;
};

type Account = {
  id: string;
  name: string;
  city: string | null;
  lastInteraction: string | null; // most-recent past event date (ISO)
  nextEvent: string | null;       // earliest upcoming event date (ISO)
  isProspect: boolean;
};

type Contact = {
  id: string;
  name: string;
  title: string | null;
  lastInteraction: string | null; // most-recent past event date (ISO)
  nextEvent: string | null;       // earliest upcoming event date (ISO)
  methodTypes: string[];
  hasNotes: boolean;
  accountName: string | null;
};

type LogEntry = {
  id: string;
  text: string;
  amount: number | null;   // null = note, number = sale
  status: 'todo' | 'done';
  created_at: string;
  accountIds: string[];
  contactIds: string[];
};

// Editing keeps the amount as a raw string while typing so the input doesn't
// fight the user (no in-flight reformatting). Parsed to a number on save.
type EditingEntry = Omit<LogEntry, 'id' | 'amount' | 'created_at'> & {
  id: string | null;
  amount: string | null;
};


// ──────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateLong(iso: string) {
  // For display: "Friday, May 1"
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function compareByLastTouch<T extends { lastInteraction: string | null }>(a: T, b: T): number {
  // Most recent first; null (never-touched) always ranks last.
  if (a.lastInteraction == null && b.lastInteraction == null) return 0;
  if (a.lastInteraction == null) return 1;
  if (b.lastInteraction == null) return -1;
  return b.lastInteraction.localeCompare(a.lastInteraction);
}

function compareByNextEvent<T extends { nextEvent: string | null }>(a: T, b: T): number {
  // Soonest first; null (no scheduled event) always ranks last.
  if (a.nextEvent == null && b.nextEvent == null) return 0;
  if (a.nextEvent == null) return 1;
  if (b.nextEvent == null) return -1;
  return a.nextEvent.localeCompare(b.nextEvent);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function relativeDay(iso: string, todayIso: string) {
  const a = new Date(iso + 'T00:00:00').getTime();
  const b = new Date(todayIso + 'T00:00:00').getTime();
  const diff = Math.round((a - b) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `In ${diff} days`;
}

const METHOD_ICON: Record<string, string> = {
  cell: '📱',
  email: '✉️',
  work: '☎️',
  home: '🏠',
  other: '·',
};

function METHOD_ICONS_FOR(types: string[]): string {
  return types.map((t) => METHOD_ICON[t] ?? '·').join(' ');
}


// ──────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────

export function MainScreen() {
  // Date being viewed
  const [viewDate, setViewDate] = useState<string>(todayIso());
  const today = todayIso();
  const isToday = viewDate === today;

  // Store reads
  const users = useDataStore((s) => s.users);
  const activeUserId = useDataStore((s) => s.activeUserId);
  const storeAccounts = useDataStore((s) => s.accounts);
  const storeContacts = useDataStore((s) => s.contacts);
  const storeEvents = useDataStore((s) => s.events);
  const storeDays = useDataStore((s) => s.days);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const eventContacts = useDataStore((s) => s.eventContacts);
  const upsertUser = useDataStore((s) => s.upsertUser);
  const setActiveUser = useDataStore((s) => s.setActiveUser);
  const upsertEvent = useDataStore((s) => s.upsertEvent);
  const deleteEvent = useDataStore((s) => s.deleteEvent);
  const upsertDay = useDataStore((s) => s.upsertDay);
  const upsertContact = useDataStore((s) => s.upsertContact);
  const storeContactMethods = useDataStore((s) => s.contactMethods);

  // Profiles — derived from users
  const profiles: Profile[] = useMemo(
    () => users.map((u, i) => ({ id: u.id, name: u.name, color: colorForUser(u, i) })),
    [users],
  );
  const activeProfile = profiles.find((p) => p.id === activeUserId);

  // Accounts — derived with split past/upcoming + effective isProspect
  const accounts: Account[] = useMemo(() => {
    const todayStr = todayIso();
    const dayDateById = new Map(storeDays.map((d) => [d.id, d.date]));
    const eventById = new Map(storeEvents.map((e) => [e.id, e]));
    const lastByAccount = new Map<string, string>();
    const nextByAccount = new Map<string, string>();
    const totalSalesByAccount = new Map<string, number>();
    for (const ea of eventAccounts) {
      const ev = eventById.get(ea.event_id);
      if (!ev || ev.is_cancelled) continue;
      const d = dayDateById.get(ev.day_id);
      if (d && isVisibleEventDate(d)) {
        if (d < todayStr) {
          const cur = lastByAccount.get(ea.account_id);
          if (!cur || d > cur) lastByAccount.set(ea.account_id, d);
        } else {
          const cur = nextByAccount.get(ea.account_id);
          if (!cur || d < cur) nextByAccount.set(ea.account_id, d);
        }
      }
      if (ev.amount != null) {
        totalSalesByAccount.set(
          ea.account_id,
          (totalSalesByAccount.get(ea.account_id) ?? 0) + ev.amount,
        );
      }
    }
    return storeAccounts
      .filter((a) => a.user_id === activeUserId)
      .map((a) => ({
        id: a.id,
        name: a.name,
        city: a.city,
        lastInteraction: lastByAccount.get(a.id) ?? null,
        nextEvent: nextByAccount.get(a.id) ?? null,
        isProspect: a.is_prospect ?? true,
      }));
  }, [storeAccounts, storeEvents, storeDays, eventAccounts, activeUserId]);

  // Contacts — derived with combined name, past/upcoming, methodTypes, hasNotes
  const contacts: Contact[] = useMemo(() => {
    const todayStr = todayIso();
    const dayDateById = new Map(storeDays.map((d) => [d.id, d.date]));
    const eventById = new Map(storeEvents.map((e) => [e.id, e]));
    const lastByContact = new Map<string, string>();
    const nextByContact = new Map<string, string>();
    for (const ec of eventContacts) {
      const ev = eventById.get(ec.event_id);
      if (!ev || ev.is_cancelled) continue;
      const d = dayDateById.get(ev.day_id);
      if (!d) continue;
      if (!isVisibleEventDate(d)) continue;
      if (d < todayStr) {
        const cur = lastByContact.get(ec.contact_id);
        if (!cur || d > cur) lastByContact.set(ec.contact_id, d);
      } else {
        const cur = nextByContact.get(ec.contact_id);
        if (!cur || d < cur) nextByContact.set(ec.contact_id, d);
      }
    }
    const methodTypesByContact = new Map<string, Set<string>>();
    for (const m of storeContactMethods) {
      const set = methodTypesByContact.get(m.contact_id) ?? new Set<string>();
      set.add(m.type);
      methodTypesByContact.set(m.contact_id, set);
    }
    const accountNameById = new Map(storeAccounts.map((a) => [a.id, a.name]));
    return storeContacts
      .filter((c) => c.user_id === activeUserId)
      .map((c) => ({
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        title: c.title,
        lastInteraction: lastByContact.get(c.id) ?? null,
        nextEvent: nextByContact.get(c.id) ?? null,
        methodTypes: Array.from(methodTypesByContact.get(c.id) ?? []),
        hasNotes: !!(c.notes && c.notes.trim().length > 0),
        accountName: c.account_id ? accountNameById.get(c.account_id) ?? null : null,
      }));
  }, [storeContacts, storeContactMethods, storeEvents, storeDays, storeAccounts, eventContacts, activeUserId]);

  // Log entries — events on the viewDate's Day, projected to the LogEntry shape
  const log: LogEntry[] = useMemo(() => {
    if (!isVisibleEventDate(viewDate)) return [];
    const day = storeDays.find((d) => d.user_id === activeUserId && d.date === viewDate);
    if (!day) return [];
    const eventsOnDay = storeEvents.filter((e) => e.day_id === day.id && !e.is_cancelled);
    return eventsOnDay.map((e) => ({
      id: e.id,
      text: e.notes ?? '',
      amount: e.amount,
      // Legacy events without `status` (the seeded sales etc.) read as 'done'.
      status: (e.status ?? 'done') as 'todo' | 'done',
      created_at: e.created_at,
      accountIds: eventAccounts.filter((ea) => ea.event_id === e.id).map((ea) => ea.account_id),
      contactIds: eventContacts.filter((ec) => ec.event_id === e.id).map((ec) => ec.contact_id),
    }));
  }, [storeDays, storeEvents, eventAccounts, eventContacts, activeUserId, viewDate]);

  // Future-dated events (strictly after today), respecting the display cutoff.
  // Used by the "Upcoming" section on the main screen.
  const upcoming = useMemo(() => {
    const todayStr = today;
    const dayDateById = new Map(storeDays.map((d) => [d.id, d.date]));
    const accountIdsByEvent = new Map<string, string[]>();
    for (const ea of eventAccounts) {
      const arr = accountIdsByEvent.get(ea.event_id) ?? [];
      arr.push(ea.account_id);
      accountIdsByEvent.set(ea.event_id, arr);
    }
    const contactIdsByEvent = new Map<string, string[]>();
    for (const ec of eventContacts) {
      const arr = contactIdsByEvent.get(ec.event_id) ?? [];
      arr.push(ec.contact_id);
      contactIdsByEvent.set(ec.event_id, arr);
    }
    return storeEvents
      .filter((e) => {
        if (e.user_id !== activeUserId) return false;
        if (e.is_cancelled) return false;
        const date = dayDateById.get(e.day_id);
        if (!date) return false;
        if (!isVisibleEventDate(date)) return false;
        return date > todayStr; // strictly future
      })
      .map((e) => ({
        id: e.id,
        date: dayDateById.get(e.day_id)!,
        notes: e.notes,
        amount: e.amount,
        status: e.status,
        accountIds: accountIdsByEvent.get(e.id) ?? [],
        contactIds: contactIdsByEvent.get(e.id) ?? [],
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [storeEvents, storeDays, eventAccounts, eventContacts, activeUserId, today]);

  // UI state
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [editing, setEditing] = useState<EditingEntry | null>(null);
  const [accountsProspectsOnly, setAccountsProspectsOnly] = useState(false);
  const [accountsSearch, setAccountsSearch] = useState('');
  const [contactsSearch, setContactsSearch] = useState('');
  type ListSort = 'alpha' | 'recent' | 'soonest';
  const [accountsSort, setAccountsSort] = useState<ListSort>('alpha');
  const [contactsSort, setContactsSort] = useState<ListSort>('alpha');

  // Modal state — single discriminated union keeps things simple.
  // 'mode' on the list modals: 'browse' opens detail on tap; 'pick' selects into editing.
  // 'selectOnSave' on the detail modals: after a successful upsert, the new id is
  // attached to editing instead of just closing.
  const [modal, setModal] = useState<
    | { kind: 'none' }
    | { kind: 'calendar' }
    | { kind: 'log-actions'; entryId: string }
    | { kind: 'upcoming-actions'; eventId: string }
    | { kind: 'accounts-list'; mode: 'browse' | 'pick' }
    | { kind: 'contacts-list'; mode: 'browse' | 'pick' | 'link-to-account'; accountId?: string }
    | { kind: 'contacts-import' }
    | { kind: 'ai-settings' }
    | { kind: 'account-detail'; accountId: string | null; selectOnSave?: boolean }
    | { kind: 'account-actions'; accountId: string }
    | { kind: 'contact-detail'; contactId: string | null; selectOnSave?: boolean; linkToAccountId?: string; returnToAccountId?: string }
    | { kind: 'contact-actions'; contactId: string }
    | { kind: 'event-form'; initial: EventFormInitial; returnToAccountId?: string }
    | { kind: 'follow-up'; source: FollowUpSource }
    | { kind: 'move-event'; source: MoveEventSource }
  >({ kind: 'none' });
  const closeModal = () => setModal({ kind: 'none' });

  // Reset list-modal search inputs whenever those modals close so the next
  // open starts fresh.
  React.useEffect(() => {
    if (modal.kind !== 'accounts-list') {
      setAccountsSearch('');
      setAccountsSort('alpha');
    }
    if (modal.kind !== 'contacts-list') {
      setContactsSearch('');
      setContactsSort('alpha');
    }
  }, [modal.kind]);

  function selectAccountIntoEditing(id: string) {
    setEditing((prev) =>
      prev && !prev.accountIds.includes(id)
        ? { ...prev, accountIds: [...prev.accountIds, id] }
        : prev,
    );
    closeModal();
  }
  function selectContactIntoEditing(id: string) {
    setEditing((prev) =>
      prev && !prev.contactIds.includes(id)
        ? { ...prev, contactIds: [...prev.contactIds, id] }
        : prev,
    );
    closeModal();
  }

  async function linkContactToAccount(contactId: string, accountId: string) {
    const c = storeContacts.find((x) => x.id === contactId);
    if (!c) return;
    const existingMethods = storeContactMethods.filter((m) => m.contact_id === contactId);
    try {
      await upsertContact(
        { ...c, account_id: accountId, updated_at: new Date().toISOString() },
        existingMethods.map((m) => ({ ...m })),
      );
    } catch (e) {
      logError(TAG, 'linkContactToAccount threw', e);
    }
    setModal({ kind: 'account-detail', accountId });
  }

  // AI Assist — single collapsible panel.
  type AiState = { status: 'idle' | 'loading' | 'ready' | 'error'; text: string; open: boolean; error?: string };
  const [ai, setAi] = useState<AiState>({ status: 'idle', text: '', open: false });

  // Reset on date change — different day, different context.
  React.useEffect(() => { setAi({ status: 'idle', text: '', open: false }); }, [viewDate]);

  // Sorted log: todos first, then done. Within each group: newest first.
  const sortedLog = useMemo(() => {
    return [...log].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [log]);

  // ── Handlers ──────────────────────────────────────────────────

  function startNewEntry() {
    // New entry default: past dates auto-mark as done; today/future default to todo.
    const defaultStatus: 'todo' | 'done' = viewDate < today ? 'done' : 'todo';
    setEditing({
      id: null,
      text: '',
      amount: null,
      status: defaultStatus,
      accountIds: [],
      contactIds: [],
    });
  }

  function startEditEntry(entry: LogEntry) {
    setEditing({
      id: entry.id,
      text: entry.text,
      amount: entry.amount != null ? String(entry.amount) : null,
      status: entry.status,
      accountIds: [...entry.accountIds],
      contactIds: [...entry.contactIds],
    });
  }

  function cancelEditing() {
    setEditing(null);
  }

  async function handleSaveEntry() {
    if (!editing) return;
    const isSale = editing.amount != null;
    const amountNum = isSale ? parseFloat((editing.amount ?? '').trim()) : null;
    if (isSale && (amountNum == null || isNaN(amountNum))) return;
    if (isSale && editing.accountIds.length !== 1) return;
    if (!isSale && !editing.text.trim()) return;
    if (!activeUserId) return;

    try {
      const now = new Date().toISOString();
      let day = storeDays.find((d) => d.user_id === activeUserId && d.date === viewDate);
      if (!day) {
        day = {
          id: generateId(),
          user_id: activeUserId,
          date: viewDate,
          notes: null,
          created_at: now,
          updated_at: now,
        } as StoreDay;
        await upsertDay(day);
      }

      const existing = editing.id ? storeEvents.find((e) => e.id === editing.id) : null;
      const event: StoreEvent = {
        id: editing.id ?? generateId(),
        user_id: activeUserId,
        day_id: day.id,
        type: isSale ? 'sale' : 'note',
        status: editing.status,
        notes: editing.text.trim(),
        amount: amountNum,
        is_cancelled: existing?.is_cancelled ?? false,
        source_event_id: existing?.source_event_id ?? null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };

      await upsertEvent(event, editing.accountIds, editing.contactIds);
      cancelEditing();
    } catch (e) {
      logError(TAG, 'handleSaveEntry threw', e);
    }
  }

  // Quick-toggle a log entry between todo and done, in place from the row.
  async function toggleEntryStatus(entryId: string) {
    const ev = storeEvents.find((e) => e.id === entryId);
    if (!ev) return;
    const accountIds = eventAccounts.filter((ea) => ea.event_id === entryId).map((ea) => ea.account_id);
    const contactIds = eventContacts.filter((ec) => ec.event_id === entryId).map((ec) => ec.contact_id);
    const next: 'todo' | 'done' = (ev.status ?? 'done') === 'done' ? 'todo' : 'done';
    try {
      await upsertEvent(
        { ...ev, status: next, updated_at: new Date().toISOString() },
        accountIds,
        contactIds,
      );
    } catch (e) {
      logError(TAG, 'toggleEntryStatus threw', e);
    }
  }

  async function handleDeleteEntry() {
    if (!editing?.id) return;
    try {
      await deleteEvent(editing.id);
      cancelEditing();
    } catch (e) {
      logError(TAG, 'handleDeleteEntry threw', e);
    }
  }

  function tapLogRow(entry: LogEntry) {
    setModal({ kind: 'log-actions', entryId: entry.id });
  }

  function startFollowUp(entry: LogEntry) {
    const ev = storeEvents.find((e) => e.id === entry.id);
    if (!ev) return;
    const day = storeDays.find((d) => d.id === ev.day_id);
    if (!day) return;
    setModal({
      kind: 'follow-up',
      source: {
        eventId: entry.id,
        sourceDate: day.date,
        sourceType: ev.type,
        sourceNotes: ev.notes,
        accountIds: [...entry.accountIds],
        contactIds: [...entry.contactIds],
      },
    });
  }

  const startMoveEvent = (entry: LogEntry) => {
    setModal({ kind: 'move-event', source: { eventId: entry.id, sourceDate: viewDate } });
  };

  const moveEventToToday = async (eventId: string) => {
    const ev = storeEvents.find((e) => e.id === eventId);
    if (!ev || !activeUserId) return;
    const todayStr = today;
    const day = storeDays.find((d) => d.id === ev.day_id);
    if (day && day.date === todayStr) return; // already on today
    const now = new Date().toISOString();
    let todayDay = storeDays.find((d) => d.user_id === activeUserId && d.date === todayStr);
    if (!todayDay) {
      todayDay = {
        id: generateId(),
        user_id: activeUserId,
        date: todayStr,
        notes: null,
        created_at: now,
        updated_at: now,
      } as StoreDay;
      await upsertDay(todayDay);
    }
    const accountIds = eventAccounts
      .filter((ea) => ea.event_id === ev.id)
      .map((ea) => ea.account_id);
    const contactIds = eventContacts
      .filter((ec) => ec.event_id === ev.id)
      .map((ec) => ec.contact_id);
    await upsertEvent(
      { ...ev, day_id: todayDay.id, updated_at: now },
      accountIds,
      contactIds,
    );
    setViewDate(todayStr);
  };

  async function runAi() {
    if (!activeUserId || !activeProfile) return;
    const apiKey = await getApiKey();
    if (!apiKey) {
      setModal({ kind: 'ai-settings' });
      return;
    }
    setAi((prev) => ({ ...prev, status: 'loading', open: true }));
    try {
      const context = buildDayContext({
        profileName: activeProfile.name,
        viewDate,
        todayIso: today,
        activeUserId,
        storeAccounts,
        storeContacts,
        storeContactMethods,
        storeEvents,
        storeDays,
        eventAccounts,
        eventContacts,
      });
      const text = await runAiAssist({ apiKey, context });
      setAi({ status: 'ready', text, open: true });
    } catch (e) {
      let message = 'Something went wrong.';
      if (e instanceof AiAuthError) message = e.message + ' Tap the avatar to update your key.';
      else if (e instanceof AiRateLimitError) message = e.message;
      else if (e instanceof AiNetworkError) message = e.message;
      else if (e instanceof AiServerError) message = e.message;
      else if (e instanceof Error) message = e.message;
      logError(TAG, 'runAi threw', e);
      setAi({ status: 'error', text: '', open: true, error: message });
    }
  }

  function tapAiButton() {
    if (ai.status === 'idle' || ai.status === 'error') runAi();
    else setAi((prev) => ({ ...prev, open: !prev.open }));
  }

  async function addProfile(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const user: User = {
      id: generateId(),
      name: trimmed,
      color: nextProfileColor(users.length),
      created_at: now,
    };
    try {
      await upsertUser(user);
      await setActiveUser(user.id);
      setProfileDropdownOpen(false);
      logInfo(TAG, 'addProfile complete', { id: user.id });
    } catch (e) {
      logError(TAG, 'addProfile threw', e);
    }
  }

  async function switchProfile(id: string) {
    try {
      await setActiveUser(id);
      setProfileDropdownOpen(false);
    } catch (e) {
      logError(TAG, 'switchProfile threw', e);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  if (!activeUserId || !activeProfile) {
    return <SafeAreaView style={styles.safe} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ─── HEADER ─────────────────────────────────────────────── */}
        <View style={[styles.header, isToday ? styles.headerToday : styles.headerOther]}>
          <View style={styles.headerLeft}>
            <Text style={styles.dateText} numberOfLines={1}>{formatDateLong(viewDate)}</Text>
            <Text style={[styles.dateSub, !isToday && styles.dateSubOther]}>
              {relativeDay(viewDate, today)}
            </Text>
          </View>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setModal({ kind: 'calendar' })}
            accessibilityRole="button"
            accessibilityLabel="Open calendar"
            hitSlop={6}
          >
            <Text style={styles.iconBtnText}>📅</Text>
          </Pressable>
          <Pressable
            style={[styles.avatarBtn, { backgroundColor: activeProfile.color }]}
            onPress={() => setProfileDropdownOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`Profile menu — ${activeProfile.name}`}
            accessibilityState={{ expanded: profileDropdownOpen }}
            hitSlop={6}
          >
            <Text style={styles.avatarText}>{initials(activeProfile.name)}</Text>
            <View style={styles.avatarCaret}>
              <Text style={styles.avatarCaretText}>{profileDropdownOpen ? '▴' : '▾'}</Text>
            </View>
          </Pressable>

          {profileDropdownOpen && (
            <>
              {/* Tap-outside scrim — full-screen so the dropdown closes when
                  the user taps anywhere else. */}
              <Pressable
                style={styles.profileDropdownScrim}
                onPress={() => setProfileDropdownOpen(false)}
              />
              <ProfileDropdown
                profiles={profiles}
                activeId={activeUserId}
                onPick={switchProfile}
                onAdd={addProfile}
                onClose={() => setProfileDropdownOpen(false)}
                onOpenAiSettings={() => {
                  setProfileDropdownOpen(false);
                  setModal({ kind: 'ai-settings' });
                }}
              />
            </>
          )}
        </View>

        {/* ─── AI SECTION ─────────────────────────────────────────── */}
        <Pressable
          style={[styles.aiBtn, ai.status !== 'idle' && styles.aiBtnActive]}
          onPress={tapAiButton}
          accessibilityRole="button"
          accessibilityLabel="AI Assist"
          accessibilityState={{ busy: ai.status === 'loading', expanded: ai.open }}
        >
          <Text style={styles.aiBtnIcon}>✦</Text>
          <Text style={styles.aiBtnText}>AI Assist</Text>
          {ai.status === 'loading' && <ActivityIndicator size="small" color="#fff" />}
        </Pressable>

        {ai.status !== 'idle' && (
          <View style={styles.aiPanel}>
            <Pressable
              style={styles.aiPanelHeader}
              onPress={() => setAi((prev) => ({ ...prev, open: !prev.open }))}
            >
              <View style={styles.aiPanelIcon}><Text style={styles.aiPanelIconText}>✦</Text></View>
              <Text style={styles.aiPanelTitle}>AI Assist</Text>
              <Pressable
                style={styles.aiRefresh}
                onPress={runAi}
                disabled={ai.status === 'loading'}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Regenerate AI Assist"
              >
                <Text style={styles.aiRefreshText}>{ai.status === 'loading' ? '…' : '↻'}</Text>
              </Pressable>
              <Text style={styles.aiPanelCaret}>{ai.open ? '▾' : '▸'}</Text>
            </Pressable>
            {ai.open && (
              <View style={styles.aiPanelBody}>
                {ai.status === 'loading' ? (
                  <View style={styles.aiLoading}>
                    <ActivityIndicator size="small" color={colors.text.link} />
                    <Text style={styles.aiLoadingText}>Thinking…</Text>
                  </View>
                ) : ai.status === 'error' ? (
                  <Text style={styles.aiPanelError}>{ai.error ?? 'Unknown error.'}</Text>
                ) : (
                  ai.text.split('\n\n').map((para, i) => (
                    <Text key={i} style={styles.aiPanelText}>{para}</Text>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* ─── LOG SECTION ────────────────────────────────────────── */}
        <View style={styles.logCard}>
          <Text style={styles.logHeader}>Log</Text>

          {sortedLog.length === 0 && !editing && (
            <Text style={styles.empty}>Nothing logged yet</Text>
          )}

          {(editing && editing.id == null
            ? [...sortedLog, null]
            : sortedLog
          ).map((entry, idx) => {
            if (entry == null) {
              return (
                <LogEditPanel
                  key="new"
                  editing={editing!}
                  accounts={accounts}
                  contacts={contacts}
                  setEditing={setEditing}
                  onPickAccount={() => setModal({ kind: 'accounts-list', mode: 'pick' })}
                  onPickContact={() => setModal({ kind: 'contacts-list', mode: 'pick' })}
                  onCancel={cancelEditing}
                  onSave={handleSaveEntry}
                  onDelete={handleDeleteEntry}
                />
              );
            }

            const isBeingEdited = editing && editing.id === entry.id;
            return (
              <React.Fragment key={entry.id}>
                <LogRow
                  entry={entry}
                  accounts={accounts}
                  contacts={contacts}
                  onPress={() => tapLogRow(entry)}
                  onToggleStatus={() => toggleEntryStatus(entry.id)}
                  showDivider={idx > 0}
                />
                {isBeingEdited && (
                  <LogEditPanel
                    editing={editing!}
                    accounts={accounts}
                    contacts={contacts}
                    setEditing={setEditing}
                    onPickAccount={() => setModal({ kind: 'accounts-list', mode: 'pick' })}
                    onPickContact={() => setModal({ kind: 'contacts-list', mode: 'pick' })}
                    onCancel={cancelEditing}
                    onSave={handleSaveEntry}
                    onDelete={handleDeleteEntry}
                  />
                )}
              </React.Fragment>
            );
          })}

          <View style={styles.addRow}>
            <Pressable style={styles.addPill} onPress={() => { if (!editing) startNewEntry(); }}>
              <Text style={styles.addPillText}>+ add</Text>
            </Pressable>
          </View>
        </View>

        {/* ─── BOTTOM BUTTONS ─────────────────────────────────────── */}
        <View style={styles.bottomRow}>
          <Pressable
            style={({ pressed }) => [styles.bottomBtn, pressed && styles.bottomBtnPressed]}
            onPress={() => setModal({ kind: 'accounts-list', mode: 'browse' })}
            accessibilityRole="button"
            accessibilityLabel={`Browse accounts. ${accounts.length} total.`}
          >
            <View style={[styles.bottomBtnIcon, { backgroundColor: colors.status.todayBg }]}>
              <Text style={[styles.bottomBtnIconText, { color: colors.status.todayText }]}>🏢</Text>
            </View>
            <View style={styles.bottomBtnTextCol}>
              <Text style={styles.bottomBtnTitle}>Accounts</Text>
              <Text style={styles.bottomBtnSub}>
                {accounts.length} {accounts.length === 1 ? 'account' : 'accounts'}
              </Text>
            </View>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.bottomBtn, pressed && styles.bottomBtnPressed]}
            onPress={() => setModal({ kind: 'contacts-list', mode: 'browse' })}
            accessibilityRole="button"
            accessibilityLabel={`Browse contacts. ${contacts.length} total.`}
          >
            <View style={[styles.bottomBtnIcon, { backgroundColor: colors.status.customerBg }]}>
              <Text style={[styles.bottomBtnIconText, { color: colors.status.customerText }]}>👤</Text>
            </View>
            <View style={styles.bottomBtnTextCol}>
              <Text style={styles.bottomBtnTitle}>Contacts</Text>
              <Text style={styles.bottomBtnSub}>
                {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ─── UPCOMING EVENTS ────────────────────────────────────── */}
        <View style={styles.upcomingSection}>
          <Text style={styles.upcomingTitle}>Upcoming</Text>
          {upcoming.length === 0 ? (
            <Text style={styles.upcomingEmpty}>Nothing scheduled.</Text>
          ) : (
            upcoming.map((u) => {
              const linkedAccts = accounts.filter((a) => u.accountIds.includes(a.id));
              const linkedConts = contacts.filter((c) => u.contactIds.includes(c.id));
              const text =
                (u.notes && u.notes.trim().length > 0)
                  ? u.notes
                  : (u.amount != null ? '(sale)' : '(no notes)');
              return (
                <Pressable
                  key={u.id}
                  style={styles.upcomingRow}
                  onPress={() => setModal({ kind: 'upcoming-actions', eventId: u.id })}
                >
                  <View style={styles.upcomingDateCol}>
                    <Text style={styles.upcomingDate}>{formatShortDate(u.date)}</Text>
                    <Text style={styles.upcomingRelative}>{relativeDay(u.date, today)}</Text>
                  </View>
                  <View style={styles.upcomingBody}>
                    <Text style={styles.upcomingText} numberOfLines={2}>{text}</Text>
                    {(u.amount != null || linkedAccts.length > 0 || linkedConts.length > 0) && (
                      <View style={styles.upcomingMeta}>
                        {u.amount != null && (
                          <View style={styles.salePill}>
                            <Text style={styles.salePillText}>${u.amount.toLocaleString()}</Text>
                          </View>
                        )}
                        {linkedAccts.slice(0, 1).map((a) => (
                          <View key={a.id} style={styles.acctPill}>
                            <Text style={styles.acctPillText} numberOfLines={1}>🏢 {a.name}</Text>
                          </View>
                        ))}
                        {linkedAccts.length > 1 && (
                          <View style={styles.acctPill}>
                            <Text style={styles.acctPillText}>+{linkedAccts.length - 1}</Text>
                          </View>
                        )}
                        {linkedConts.slice(0, 1).map((c) => (
                          <View key={c.id} style={styles.contPill}>
                            <Text style={styles.contPillText} numberOfLines={1}>👤 {c.name}</Text>
                          </View>
                        ))}
                        {linkedConts.length > 1 && (
                          <View style={styles.contPill}>
                            <Text style={styles.contPillText}>+{linkedConts.length - 1}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

      </ScrollView>

      {/* ─── MODALS ───────────────────────────────────────────────── */}

      {/* Calendar */}
      <CalendarModal
        visible={modal.kind === 'calendar'}
        viewDate={viewDate}
        onPick={(iso) => { setViewDate(iso); closeModal(); }}
        onClose={closeModal}
      />

      {/* Log row action sheet */}
      {modal.kind === 'log-actions' && (() => {
        const entry = log.find((e) => e.id === modal.entryId);
        if (!entry) {
          return (
            <RowActionsSheet
              visible
              onClose={closeModal}
              title=""
              actions={[]}
            />
          );
        }
        const linkedAccts = accounts.filter((a) => entry.accountIds.includes(a.id));
        const linkedConts = contacts.filter((c) => entry.contactIds.includes(c.id));

        const confirmDelete = () => {
          Alert.alert(
            'Delete this log entry?',
            'This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  closeModal();
                  try { await deleteEvent(entry.id); }
                  catch (e) { logError(TAG, 'log-actions delete threw', e); }
                },
              },
            ],
          );
        };

        const sourceEvent = (() => {
          const ev = storeEvents.find((e) => e.id === entry.id);
          if (!ev || !ev.source_event_id) return null;
          const src = storeEvents.find((e) => e.id === ev.source_event_id);
          if (!src || src.is_cancelled) return null;
          const day = storeDays.find((d) => d.id === src.day_id);
          return day ? { event: src, date: day.date } : null;
        })();

        const followUps = storeEvents
          .filter((e) => e.source_event_id === entry.id && !e.is_cancelled)
          .map((e) => {
            const day = storeDays.find((d) => d.id === e.day_id);
            return day ? { event: e, date: day.date } : null;
          })
          .filter((x): x is { event: typeof storeEvents[number]; date: string } => x !== null)
          .sort((a, b) => a.date.localeCompare(b.date));

        const actions: RowAction[] = [
          {
            key: 'edit',
            icon: '✏️',
            label: 'Edit',
            onPress: () => { closeModal(); startEditEntry(entry); },
          },
          {
            key: 'follow-up',
            icon: '➤',
            label: 'Follow-up…',
            onPress: () => { closeModal(); startFollowUp(entry); },
          },
          {
            key: 'move',
            icon: '↔️',
            label: 'Move to…',
            onPress: () => { closeModal(); startMoveEvent(entry); },
          },
          {
            key: 'delete',
            icon: '🗑️',
            label: 'Delete',
            destructive: true,
            onPress: confirmDelete,
          },
        ];

        const groups: RowActionGroup[] = [];

        const relatedItems: RowAction[] = [];
        if (sourceEvent) {
          relatedItems.push({
            key: `source-${sourceEvent.event.id}`,
            icon: '↩️',
            label: `View original (${formatShortDate(sourceEvent.date)})`,
            onPress: () => { setViewDate(sourceEvent.date); closeModal(); },
          });
        }
        for (const fu of followUps) {
          const labelText = fu.event.notes && fu.event.notes.trim().length > 0
            ? `${formatShortDate(fu.date)} — ${fu.event.notes.trim()}`
            : `View follow-up (${formatShortDate(fu.date)})`;
          relatedItems.push({
            key: `followup-${fu.event.id}`,
            icon: '➤',
            label: labelText,
            onPress: () => { setViewDate(fu.date); closeModal(); },
          });
        }
        if (relatedItems.length > 0) {
          groups.push({ label: 'Related', items: relatedItems });
        }

        if (linkedAccts.length > 0) {
          groups.push({
            label: 'Accounts',
            items: linkedAccts.map((a) => ({
              key: a.id,
              icon: '🏢',
              iconBackground: colors.status.todayBg,
              iconColor: colors.status.todayText,
              label: a.name,
              onPress: () => setModal({ kind: 'account-detail', accountId: a.id }),
            })),
          });
        }
        if (linkedConts.length > 0) {
          groups.push({
            label: 'Contacts',
            items: linkedConts.map((c) => ({
              key: c.id,
              icon: '👤',
              iconBackground: colors.status.customerBg,
              iconColor: colors.status.customerText,
              label: c.name,
              onPress: () => setModal({ kind: 'contact-detail', contactId: c.id }),
            })),
          });
        }

        return (
          <RowActionsSheet
            visible
            onClose={closeModal}
            title={entry.text}
            actions={actions}
            groups={groups}
          />
        );
      })()}

      {/* Account row action sheet */}
      {modal.kind === 'account-actions' && (() => {
        const account = storeAccounts.find((a) => a.id === modal.accountId);
        if (!account) {
          return (
            <RowActionsSheet visible onClose={closeModal} title="" actions={[]} />
          );
        }
        const primary = account.primary_contact_id
          ? storeContacts.find((c) => c.id === account.primary_contact_id) ?? null
          : null;

        const actions: RowAction[] = [
          {
            key: 'open',
            icon: '🏢',
            iconBackground: colors.status.todayBg,
            iconColor: colors.status.todayText,
            label: 'Open account',
            onPress: () => setModal({ kind: 'account-detail', accountId: account.id }),
          },
          {
            key: 'add-event',
            icon: '＋',
            label: 'Add event…',
            onPress: () => {
              setModal({
                kind: 'event-form',
                initial: { date: viewDate, accountIds: [account.id] },
              });
            },
          },
        ];

        const groups: RowActionGroup[] = [];
        if (primary) {
          const primaryName = `${primary.first_name} ${primary.last_name}`.trim() || '—';
          groups.push({
            label: 'Primary contact',
            items: [
              {
                key: primary.id,
                icon: '👤',
                iconBackground: colors.status.customerBg,
                iconColor: colors.status.customerText,
                label: primaryName,
                onPress: () => setModal({ kind: 'contact-detail', contactId: primary.id }),
              },
            ],
          });
        }

        return (
          <RowActionsSheet
            visible
            onClose={closeModal}
            title={account.name}
            actions={actions}
            groups={groups}
          />
        );
      })()}

      {/* Contact row action sheet */}
      {modal.kind === 'contact-actions' && (() => {
        const contact = storeContacts.find((c) => c.id === modal.contactId);
        if (!contact) {
          return (
            <RowActionsSheet visible onClose={closeModal} title="" actions={[]} />
          );
        }
        const fullName = `${contact.first_name} ${contact.last_name}`.trim() || '—';
        const linkedAccount = contact.account_id
          ? storeAccounts.find((a) => a.id === contact.account_id) ?? null
          : null;

        const myMethods = storeContactMethods
          .filter((m) => m.contact_id === contact.id)
          .sort((a, b) => {
            const order: Record<string, number> = { cell: 0, work: 1, home: 2, email: 3, other: 4 };
            const oa = order[a.type] ?? 99;
            const ob = order[b.type] ?? 99;
            if (oa !== ob) return oa - ob;
            return Number(b.is_primary) - Number(a.is_primary);
          });

        const actions: RowAction[] = [
          {
            key: 'open',
            icon: '👤',
            iconBackground: colors.status.customerBg,
            iconColor: colors.status.customerText,
            label: 'Open contact',
            onPress: () => setModal({ kind: 'contact-detail', contactId: contact.id }),
          },
          {
            key: 'add-event',
            icon: '＋',
            label: 'Add event…',
            onPress: () => {
              setModal({
                kind: 'event-form',
                initial: {
                  date: viewDate,
                  accountIds: contact.account_id ? [contact.account_id] : [],
                  contactIds: [contact.id],
                },
              });
            },
          },
        ];

        const groups: RowActionGroup[] = [];
        if (linkedAccount) {
          groups.push({
            label: 'Linked account',
            items: [
              {
                key: linkedAccount.id,
                icon: '🏢',
                iconBackground: colors.status.todayBg,
                iconColor: colors.status.todayText,
                label: linkedAccount.name,
                onPress: () => setModal({ kind: 'account-detail', accountId: linkedAccount.id }),
              },
            ],
          });
        }

        if (myMethods.length > 0) {
          const items: RowAction[] = [];
          for (const m of myMethods) {
            const value = m.value;
            if (m.type === 'cell') {
              items.push({
                key: `${m.id}-call`,
                icon: '☎',
                label: `Call cell  ${value}`,
                onPress: () => {
                  const url = `tel:${value.replace(/\D/g, '')}`;
                  Linking.openURL(url).catch((e) => logError(TAG, 'Linking.openURL tel: threw', e));
                },
              });
              items.push({
                key: `${m.id}-text`,
                icon: '💬',
                label: `Text cell  ${value}`,
                onPress: () => {
                  const url = `sms:${value.replace(/\D/g, '')}`;
                  Linking.openURL(url).catch((e) => logError(TAG, 'Linking.openURL sms: threw', e));
                },
              });
            } else if (m.type === 'work' || m.type === 'home') {
              items.push({
                key: `${m.id}-call`,
                icon: '☎',
                label: `Call ${m.type}  ${value}`,
                onPress: () => {
                  const url = `tel:${value.replace(/\D/g, '')}`;
                  Linking.openURL(url).catch((e) => logError(TAG, 'Linking.openURL tel: threw', e));
                },
              });
            } else if (m.type === 'email') {
              items.push({
                key: `${m.id}-email`,
                icon: '✉',
                label: `Email      ${value}`,
                onPress: () => {
                  const url = `mailto:${value}`;
                  Linking.openURL(url).catch((e) => logError(TAG, 'Linking.openURL mailto: threw', e));
                },
              });
            } else {
              items.push({
                key: m.id,
                icon: '•',
                label: value,
                onPress: () => {},
              });
            }
          }
          groups.push({ label: 'Contact', items });
        }

        return (
          <RowActionsSheet
            visible
            onClose={closeModal}
            title={fullName}
            actions={actions}
            groups={groups}
          />
        );
      })()}

      {/* Upcoming row action sheet */}
      {modal.kind === 'upcoming-actions' && (() => {
        const ev = storeEvents.find((e) => e.id === modal.eventId);
        if (!ev) {
          return <RowActionsSheet visible onClose={closeModal} title="" actions={[]} />;
        }
        const day = storeDays.find((d) => d.id === ev.day_id);
        if (!day) {
          return <RowActionsSheet visible onClose={closeModal} title="" actions={[]} />;
        }
        const title =
          (ev.notes && ev.notes.trim().length > 0)
            ? ev.notes
            : (ev.amount != null ? `Sale $${ev.amount.toLocaleString()}` : '(no notes)');

        const actions: RowAction[] = [
          {
            key: 'goto',
            icon: '📅',
            label: `Go to ${formatShortDate(day.date)}`,
            onPress: () => { setViewDate(day.date); closeModal(); },
          },
          {
            key: 'today',
            icon: '⤓',
            label: 'Move to today',
            onPress: () => {
              closeModal();
              moveEventToToday(ev.id);
            },
          },
        ];

        return (
          <RowActionsSheet
            visible
            onClose={closeModal}
            title={title}
            actions={actions}
          />
        );
      })()}

      {/* Accounts list (browse or pick) */}
      <Modal
        visible={modal.kind === 'accounts-list'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {modal.kind === 'accounts-list' && (() => {
              const isPick = modal.mode === 'pick';
              const linkedSet = new Set(editing?.accountIds ?? []);
              const q = accountsSearch.trim().toLowerCase();
              const visibleAccounts = accounts
                .filter((a) => !accountsProspectsOnly || a.isProspect)
                .filter((a) => {
                  if (!q) return true;
                  return (
                    a.name.toLowerCase().includes(q) ||
                    (a.city ?? '').toLowerCase().includes(q)
                  );
                })
                .slice()
                .sort((a, b) => {
                  if (accountsSort === 'recent') return compareByLastTouch(a, b);
                  if (accountsSort === 'soonest') return compareByNextEvent(a, b);
                  return a.name.localeCompare(b.name);
                });
              return (
                <>
                  <Text style={styles.modalTitle}>{isPick ? 'Link an account' : 'Accounts'}</Text>
                  <View style={styles.modalSearchRow}>
                    <TextInput
                      style={styles.modalSearch}
                      value={accountsSearch}
                      onChangeText={setAccountsSearch}
                      placeholder="Search accounts…"
                      placeholderTextColor={colors.form.inputPlaceholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.modalActions}>
                    <Pressable
                      style={styles.addPill}
                      onPress={() => setModal({ kind: 'account-detail', accountId: null, selectOnSave: isPick })}
                    >
                      <Text style={styles.addPillText}>+ Add new</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.filterChip, accountsProspectsOnly && styles.filterChipActive]}
                      onPress={() => setAccountsProspectsOnly((v) => !v)}
                    >
                      <Text style={[styles.filterChipText, accountsProspectsOnly && styles.filterChipTextActive]}>
                        {accountsProspectsOnly ? '✓ Prospects only' : '🌱 Prospects only'}
                      </Text>
                    </Pressable>
                  </View>
                  <SortToggle value={accountsSort} onChange={setAccountsSort} />
                  <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                    {visibleAccounts.length === 0 && (
                      <Text style={styles.empty}>No matches</Text>
                    )}
                    {visibleAccounts.map((a) => {
                      const used = isPick && linkedSet.has(a.id);
                      return (
                        <Pressable
                          key={a.id}
                          style={[styles.modalListRow, used && styles.modalListRowDisabled]}
                          disabled={used}
                          onPress={() =>
                            isPick
                              ? selectAccountIntoEditing(a.id)
                              : setModal({ kind: 'account-actions', accountId: a.id })
                          }
                        >
                          <View style={[styles.modalRowIcon, { backgroundColor: colors.status.todayBg }]}>
                            <Text style={{ color: colors.status.todayText }}>🏢</Text>
                          </View>
                          <Text style={[styles.modalRowText, used && styles.modalRowTextDisabled]}>{a.name}</Text>
                          {a.isProspect && <Text style={styles.prospectTag}>🌱</Text>}
                          <View style={styles.modalListDateCol}>
                            {used ? (
                              <Text style={styles.modalListDate}>linked</Text>
                            ) : (
                              <>
                                {a.nextEvent ? (
                                  <Text style={styles.modalListDateNext}>next {relativeDay(a.nextEvent, today)}</Text>
                                ) : null}
                                {a.lastInteraction ? (
                                  <Text style={styles.modalListDateLast}>last {relativeDay(a.lastInteraction, today)}</Text>
                                ) : null}
                                {!a.nextEvent && !a.lastInteraction ? (
                                  <Text style={styles.modalListDate}>—</Text>
                                ) : null}
                              </>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Pressable style={styles.modalCancel} onPress={closeModal}>
                    <Text style={styles.modalCancelText}>{isPick ? 'Cancel' : 'Close'}</Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Contacts list (browse or pick) */}
      <Modal
        visible={modal.kind === 'contacts-list'}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            {modal.kind === 'contacts-list' && (() => {
              const isPick = modal.mode === 'pick';
              const isLink = modal.mode === 'link-to-account';
              const linkedSet = new Set(editing?.contactIds ?? []);
              const linkAccountId = isLink ? modal.accountId ?? null : null;
              const title = isPick ? 'Link a contact' : isLink ? 'Add a contact to this account' : 'Contacts';
              const q = contactsSearch.trim().toLowerCase();
              const visibleContacts = contacts
                .filter((c) => {
                  if (!q) return true;
                  return (
                    c.name.toLowerCase().includes(q) ||
                    (c.accountName ?? '').toLowerCase().includes(q)
                  );
                })
                .slice()
                .sort((a, b) => {
                  if (contactsSort === 'recent') return compareByLastTouch(a, b);
                  if (contactsSort === 'soonest') return compareByNextEvent(a, b);
                  return a.name.localeCompare(b.name);
                });
              return (
                <>
                  <Text style={styles.modalTitle}>{title}</Text>
                  <View style={styles.modalSearchRow}>
                    <TextInput
                      style={styles.modalSearch}
                      value={contactsSearch}
                      onChangeText={setContactsSearch}
                      placeholder="Search contacts…"
                      placeholderTextColor={colors.form.inputPlaceholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.modalActions}>
                    <Pressable
                      style={styles.addPill}
                      onPress={() => setModal({
                        kind: 'contact-detail',
                        contactId: null,
                        selectOnSave: isPick,
                        linkToAccountId: isLink ? linkAccountId ?? undefined : undefined,
                        returnToAccountId: isLink ? linkAccountId ?? undefined : undefined,
                      })}
                    >
                      <Text style={styles.addPillText}>+ Add new</Text>
                    </Pressable>
                    {!isLink && (
                      <Pressable
                        style={styles.addPill}
                        onPress={() => setModal({ kind: 'contacts-import' })}
                      >
                        <Text style={styles.addPillText}>↓ Import from phone</Text>
                      </Pressable>
                    )}
                  </View>
                  <SortToggle value={contactsSort} onChange={setContactsSort} />
                  <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                    {visibleContacts.length === 0 && (
                      <Text style={styles.empty}>No matches</Text>
                    )}
                    {visibleContacts.map((c) => {
                      const storeContact = storeContacts.find((sc) => sc.id === c.id);
                      const alreadyLinked = isLink && storeContact?.account_id === linkAccountId;
                      const used = (isPick && linkedSet.has(c.id)) || alreadyLinked;
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.modalListRow, used && styles.modalListRowDisabled]}
                          disabled={used}
                          onPress={() => {
                            if (isPick) selectContactIntoEditing(c.id);
                            else if (isLink && linkAccountId) linkContactToAccount(c.id, linkAccountId);
                            else setModal({ kind: 'contact-actions', contactId: c.id });
                          }}
                        >
                          <View style={[styles.modalRowIcon, { backgroundColor: colors.status.customerBg }]}>
                            <Text style={{ color: colors.status.customerText }}>👤</Text>
                          </View>
                          <View style={styles.contactRowText}>
                            <Text style={[styles.modalRowText, used && styles.modalRowTextDisabled]} numberOfLines={1}>
                              {c.name || '—'}{c.accountName ? <Text style={styles.contactRowAccount}>  ({c.accountName})</Text> : null}
                            </Text>
                            {(c.methodTypes.length > 0 || c.hasNotes) && (
                              <Text style={styles.contactRowIcons}>
                                {METHOD_ICONS_FOR(c.methodTypes)}
                                {c.hasNotes ? ' 📝' : ''}
                              </Text>
                            )}
                          </View>
                          <View style={styles.modalListDateCol}>
                            {used ? (
                              <Text style={styles.modalListDate}>linked</Text>
                            ) : (
                              <>
                                {c.nextEvent ? (
                                  <Text style={styles.modalListDateNext}>next {relativeDay(c.nextEvent, today)}</Text>
                                ) : null}
                                {c.lastInteraction ? (
                                  <Text style={styles.modalListDateLast}>last {relativeDay(c.lastInteraction, today)}</Text>
                                ) : null}
                                {!c.nextEvent && !c.lastInteraction ? (
                                  <Text style={styles.modalListDate}>—</Text>
                                ) : null}
                              </>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  <Pressable style={styles.modalCancel} onPress={closeModal}>
                    <Text style={styles.modalCancelText}>{isPick || isLink ? 'Cancel' : 'Close'}</Text>
                  </Pressable>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Import contacts from device */}
      <ImportContactsModal
        visible={modal.kind === 'contacts-import'}
        onClose={closeModal}
      />

      {/* AI settings — Anthropic key */}
      <AiSettingsModal
        visible={modal.kind === 'ai-settings'}
        onClose={closeModal}
        onSaved={() => { /* user can tap AI Assist again now */ }}
      />

      {/* Account detail / add */}
      <AccountDetailModal
        visible={modal.kind === 'account-detail'}
        accountId={modal.kind === 'account-detail' ? modal.accountId : null}
        onClose={closeModal}
        onSaved={
          modal.kind === 'account-detail' && modal.selectOnSave
            ? (id) => selectAccountIntoEditing(id)
            : undefined
        }
        onOpenContact={(id) => setModal({ kind: 'contact-detail', contactId: id })}
        onAddContact={(accountId) => setModal({ kind: 'contacts-list', mode: 'link-to-account', accountId })}
        onOpenDay={(date) => { setViewDate(date); closeModal(); }}
        onAddEvent={(accountId) => {
          const acct = storeAccounts.find((a) => a.id === accountId);
          setModal({
            kind: 'event-form',
            returnToAccountId: accountId,
            initial: {
              accountIds: [accountId],
              primaryAccountId: accountId,
              title: acct ? `New event for ${acct.name}` : 'New event',
            },
          });
        }}
      />

      {/* Contact detail / add */}
      <ContactDetailModal
        visible={modal.kind === 'contact-detail'}
        contactId={modal.kind === 'contact-detail' ? modal.contactId : null}
        linkToAccountId={modal.kind === 'contact-detail' ? modal.linkToAccountId : undefined}
        onClose={() => {
          if (modal.kind === 'contact-detail' && modal.returnToAccountId) {
            setModal({ kind: 'account-detail', accountId: modal.returnToAccountId });
          } else {
            closeModal();
          }
        }}
        onSaved={
          modal.kind === 'contact-detail' && modal.selectOnSave
            ? (id) => selectContactIntoEditing(id)
            : modal.kind === 'contact-detail' && modal.returnToAccountId
            ? () => setModal({ kind: 'account-detail', accountId: modal.returnToAccountId! })
            : undefined
        }
        onOpenAccount={(id) => setModal({ kind: 'account-detail', accountId: id })}
        onOpenDay={(date) => { setViewDate(date); closeModal(); }}
        onAddEvent={(contactId) => {
          const c = storeContacts.find((x) => x.id === contactId);
          const fullName = c ? `${c.first_name} ${c.last_name}`.trim() || '—' : '';
          const accountIds = c?.account_id ? [c.account_id] : [];
          setModal({
            kind: 'event-form',
            initial: {
              contactIds: [contactId],
              accountIds,
              primaryAccountId: c?.account_id ?? null,
              title: fullName ? `New event for ${fullName}` : 'New event',
            },
          });
        }}
      />

      {/* Event form (used for add-from-account) */}
      <EventFormModal
        visible={modal.kind === 'event-form'}
        initial={modal.kind === 'event-form' ? modal.initial : { accountIds: [] }}
        onClose={() => {
          if (modal.kind === 'event-form' && modal.returnToAccountId) {
            setModal({ kind: 'account-detail', accountId: modal.returnToAccountId });
          } else {
            closeModal();
          }
        }}
        onSaved={() => {
          if (modal.kind === 'event-form' && modal.returnToAccountId) {
            setModal({ kind: 'account-detail', accountId: modal.returnToAccountId });
          } else {
            closeModal();
          }
        }}
      />

      {/* Follow-up from event */}
      <FollowUpModal
        visible={modal.kind === 'follow-up'}
        source={modal.kind === 'follow-up' ? modal.source : null}
        onClose={closeModal}
        onNavigateToDate={(date) => { setViewDate(date); closeModal(); }}
      />

      <MoveEventModal
        visible={modal.kind === 'move-event'}
        source={modal.kind === 'move-event' ? modal.source : null}
        onClose={closeModal}
        onNavigateToDate={(iso) => { setViewDate(iso); closeModal(); }}
      />

    </SafeAreaView>
  );
}

// ──────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────────

function ProfileDropdown(props: {
  profiles: Profile[];
  activeId: string;
  onPick: (id: string) => void;
  onAdd: (name: string) => void;
  onClose: () => void;
  onOpenAiSettings: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <View style={styles.profileDropdown}>
      {props.profiles.map((p) => (
        <Pressable
          key={p.id}
          style={[styles.dropdownItem, p.id === props.activeId && styles.dropdownItemActive]}
          onPress={() => props.onPick(p.id)}
        >
          <View style={[styles.dropdownAvatar, { backgroundColor: p.color }]}>
            <Text style={styles.dropdownAvatarText}>{initials(p.name)}</Text>
          </View>
          <Text style={styles.dropdownText}>{p.name}</Text>
          {p.id === props.activeId && <Text style={styles.dropdownCheck}>✓</Text>}
        </Pressable>
      ))}
      {adding ? (
        <View style={styles.dropdownAddRow}>
          <View style={styles.dropdownAddIcon}><Text style={styles.dropdownAddIconText}>+</Text></View>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoFocus
            style={styles.dropdownInput}
            placeholder="New profile name"
            placeholderTextColor={colors.form.inputPlaceholder}
            onSubmitEditing={() => { props.onAdd(draft); setAdding(false); setDraft(''); }}
          />
          <Pressable
            style={styles.dropdownConfirm}
            onPress={() => { props.onAdd(draft); setAdding(false); setDraft(''); }}
          >
            <Text style={styles.dropdownConfirmText}>✓</Text>
          </Pressable>
          <Pressable
            style={styles.dropdownCancel}
            onPress={() => { setAdding(false); setDraft(''); }}
          >
            <Text style={styles.dropdownCancelText}>×</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.dropdownItem, styles.dropdownAddItem]} onPress={() => setAdding(true)}>
          <View style={styles.dropdownAddIcon}><Text style={styles.dropdownAddIconText}>+</Text></View>
          <Text style={[styles.dropdownText, { color: colors.text.link }]}>New</Text>
        </Pressable>
      )}
      <Pressable style={styles.dropdownItem} onPress={props.onOpenAiSettings}>
        <View style={styles.dropdownAddIcon}><Text style={styles.dropdownAddIconText}>✦</Text></View>
        <Text style={[styles.dropdownText, { color: colors.text.secondary }]}>API key…</Text>
      </Pressable>
    </View>
  );
}

function LogRow(props: {
  entry: LogEntry;
  accounts: Account[];
  contacts: Contact[];
  onPress: () => void;
  onToggleStatus: () => void;
  showDivider: boolean;
}) {
  const { entry } = props;
  const acctCount = entry.accountIds.length;
  const contCount = entry.contactIds.length;
  const isDone = entry.status === 'done';
  const hasMeta = entry.amount != null || acctCount > 0 || contCount > 0;
  const text = entry.text || (entry.amount != null ? '(sale)' : '');

  return (
    <Pressable
      onPress={props.onPress}
      style={[styles.logRow, props.showDivider && styles.logRowBordered]}
      accessibilityRole="button"
      accessibilityLabel={`${isDone ? 'Done' : 'To do'}: ${text}`}
    >
      <Pressable
        style={[styles.statusToggle, isDone && styles.statusToggleDone]}
        onPress={(e) => { e.stopPropagation(); props.onToggleStatus(); }}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        accessibilityLabel={isDone ? 'Mark as to do' : 'Mark as done'}
      >
        {isDone ? <Text style={styles.statusToggleMark}>✓</Text> : null}
      </Pressable>
      <View style={styles.logRowBody}>
        <Text
          style={[styles.logRowText, isDone && styles.logRowTextDone]}
          numberOfLines={2}
        >
          {text}
        </Text>
        {hasMeta && (
          <View style={styles.logRowMeta}>
            {entry.amount != null && (
              <View style={styles.salePill}>
                <Text style={styles.salePillText}>${entry.amount.toLocaleString()}</Text>
              </View>
            )}
            {acctCount > 0 && (
              <View style={styles.acctPill}>
                <Text style={styles.acctPillText}>🏢 {acctCount}</Text>
              </View>
            )}
            {contCount > 0 && (
              <View style={styles.contPill}>
                <Text style={styles.contPillText}>👤 {contCount}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      <Pressable
        style={styles.kebabBtn}
        onPress={(e) => { e.stopPropagation(); props.onPress(); }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Open row menu"
      >
        <Text style={styles.kebabBtnText}>⋯</Text>
      </Pressable>
    </Pressable>
  );
}

function LogEditPanel(props: {
  editing: EditingEntry;
  accounts: Account[];
  contacts: Contact[];
  setEditing: (e: EditingEntry) => void;
  onPickAccount: () => void;
  onPickContact: () => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { editing, accounts, contacts, setEditing } = props;
  const showAmount = editing.amount != null;

  const linkedAccts = accounts.filter((a) => editing.accountIds.includes(a.id));
  const linkedConts = contacts.filter((c) => editing.contactIds.includes(c.id));

  const isSale = showAmount;
  const amountStr = (editing.amount ?? '').trim();
  const parsedAmount = parseFloat(amountStr);
  const saleAmountValid = !isSale || (amountStr.length > 0 && !isNaN(parsedAmount));
  const saleAccountValid = !isSale || editing.accountIds.length === 1;
  const textValid = isSale ? true : editing.text.trim().length > 0;
  const canSave = textValid && saleAmountValid && saleAccountValid;
  const blockedReason =
    !textValid ? 'Add a note before saving.'
    : !saleAmountValid ? 'Enter a valid sale amount.'
    : !saleAccountValid ? `A sale needs exactly one account (you have ${editing.accountIds.length}).`
    : null;

  return (
    <View style={styles.editPanel}>
      <TextInput
        style={styles.editTextarea}
        multiline
        value={editing.text}
        onChangeText={(t) => setEditing({ ...editing, text: t })}
        placeholder="What happened? Or what needs to happen?"
        placeholderTextColor={colors.form.inputPlaceholder}
        autoFocus
      />

      <View style={styles.statusRow}>
        <Text style={styles.statusRowLabel}>Status</Text>
        <Pressable
          style={[styles.statusChip, editing.status === 'todo' && styles.statusChipActiveTodo]}
          onPress={() => setEditing({ ...editing, status: 'todo' })}
        >
          <Text style={[styles.statusChipText, editing.status === 'todo' && styles.statusChipActiveText]}>
            ☐  To do
          </Text>
        </Pressable>
        <Pressable
          style={[styles.statusChip, editing.status === 'done' && styles.statusChipActiveDone]}
          onPress={() => setEditing({ ...editing, status: 'done' })}
        >
          <Text style={[styles.statusChipText, editing.status === 'done' && styles.statusChipActiveText]}>
            ✓  Done
          </Text>
        </Pressable>
      </View>

      {showAmount && (
        <View style={styles.editAmountRow}>
          <Text style={styles.editAmountIcon}>$</Text>
          <TextInput
            style={styles.editAmountInput}
            keyboardType="decimal-pad"
            value={editing.amount ?? ''}
            onChangeText={(v) => setEditing({ ...editing, amount: v })}
            placeholder="0.00"
            placeholderTextColor={colors.form.inputPlaceholder}
          />
          <Pressable onPress={() => setEditing({ ...editing, amount: null })}>
            <Text style={styles.removeLink}>remove</Text>
          </Pressable>
        </View>
      )}

      {(linkedAccts.length > 0 || linkedConts.length > 0) && (
        <View style={styles.editChips}>
          {linkedAccts.map((a) => (
            <Pressable
              key={a.id}
              style={styles.acctChip}
              onPress={() => setEditing({ ...editing, accountIds: editing.accountIds.filter((id) => id !== a.id) })}
            >
              <Text style={styles.acctChipText}>🏢 {a.name} ×</Text>
            </Pressable>
          ))}
          {linkedConts.map((c) => (
            <Pressable
              key={c.id}
              style={styles.contChip}
              onPress={() => setEditing({ ...editing, contactIds: editing.contactIds.filter((id) => id !== c.id) })}
            >
              <Text style={styles.contChipText}>👤 {c.name} ×</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.editAddChips}>
        <Pressable style={styles.editAddChip} onPress={props.onPickAccount}>
          <Text style={styles.editAddChipText}>🏢 + account</Text>
        </Pressable>
        <Pressable style={styles.editAddChip} onPress={props.onPickContact}>
          <Text style={styles.editAddChipText}>👤 + contact</Text>
        </Pressable>
        {!showAmount && (
          <Pressable
            style={styles.editAddChip}
            onPress={() => setEditing({ ...editing, amount: '' })}
          >
            <Text style={styles.editAddChipText}>$ + sale</Text>
          </Pressable>
        )}
      </View>

      {blockedReason && (
        <Text style={styles.blockedHint}>{blockedReason}</Text>
      )}

      <View style={styles.editActions}>
        {editing.id != null && (
          <View style={styles.editActionsDelete}>
            <Button
              label="Delete"
              onPress={props.onDelete}
              variant="destructiveGhost"
              size="sm"
            />
          </View>
        )}
        <Button label="Cancel" onPress={props.onCancel} variant="ghost" size="sm" />
        <Button
          label="Save"
          onPress={props.onSave}
          variant="primary"
          size="sm"
          disabled={!canSave}
        />
      </View>
    </View>
  );
}

function SortToggle(props: {
  value: 'alpha' | 'recent' | 'soonest';
  onChange: (v: 'alpha' | 'recent' | 'soonest') => void;
}) {
  return (
    <View style={styles.sortRow}>
      <Text style={styles.sortLabel}>Sort:</Text>
      <Pressable
        style={[styles.sortBtn, props.value === 'alpha' && styles.sortBtnActive]}
        onPress={() => props.onChange('alpha')}
      >
        <Text style={[styles.sortBtnText, props.value === 'alpha' && styles.sortBtnTextActive]}>A–Z</Text>
      </Pressable>
      <Pressable
        style={[styles.sortBtn, props.value === 'recent' && styles.sortBtnActive]}
        onPress={() => props.onChange('recent')}
      >
        <Text style={[styles.sortBtnText, props.value === 'recent' && styles.sortBtnTextActive]}>Last touch</Text>
      </Pressable>
      <Pressable
        style={[styles.sortBtn, props.value === 'soonest' && styles.sortBtnActive]}
        onPress={() => props.onChange('soonest')}
      >
        <Text style={[styles.sortBtnText, props.value === 'soonest' && styles.sortBtnTextActive]}>Next touch</Text>
      </Pressable>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────
// STYLES
// ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing[4], paddingBottom: spacing[12], gap: spacing[3] },

  // Header
  header: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    position: 'relative',
    zIndex: 10,
  },
  headerToday: {
    borderColor: colors.interactive.primary,
    borderWidth: 1.5,
  },
  headerOther: {
    backgroundColor: colors.bg.sunken,
    borderStyle: 'dashed',
  },
  headerLeft: { flex: 1, minWidth: 0 },
  dateText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  dateSub: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },
  dateSubOther: {
    color: colors.text.link,
    fontWeight: typography.weight.medium,
  },
  iconBtn: {
    width: 40, height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.bg.sunken,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 18 },
  avatarBtn: {
    width: 40, height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.border.default,
    position: 'relative',
  },
  avatarText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: '#fff',
  },
  avatarCaret: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: colors.bg.sunken,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCaretText: {
    color: colors.text.primary,
    fontSize: 9,
    lineHeight: 10,
  },

  // Profile dropdown
  profileDropdownScrim: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 20,
  },
  profileDropdown: {
    position: 'absolute',
    top: '100%',
    right: spacing[2],
    marginTop: spacing[1],
    backgroundColor: colors.bg.sunken,
    borderRadius: radius.md,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    minWidth: 220,
    overflow: 'hidden',
    zIndex: 30,
  },
  dropdownItem: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  dropdownItemActive: { backgroundColor: colors.bg.surface },
  dropdownAddItem: {},
  dropdownAvatar: {
    width: 24, height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAvatarText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: '#fff',
  },
  dropdownText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  dropdownCheck: { color: colors.text.link, fontSize: 14 },
  dropdownAddIcon: {
    width: 24, height: 24,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownAddIconText: {
    color: colors.text.link,
    fontSize: 14,
    fontWeight: typography.weight.semibold,
  },
  dropdownAddRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.bg.surface,
  },
  dropdownInput: {
    flex: 1,
    backgroundColor: colors.form.inputBg,
    borderWidth: 1,
    borderColor: colors.form.inputFocusBorder,
    borderRadius: radius.sm,
    color: colors.form.inputText,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    fontSize: typography.size.sm,
  },
  dropdownConfirm: {
    width: 26, height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.interactive.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownConfirmText: { color: '#fff', fontWeight: typography.weight.bold },
  dropdownCancel: {
    width: 26, height: 26,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownCancelText: { color: colors.text.secondary, fontSize: 14 },

  // AI Assist single button
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  aiBtnActive: {
    backgroundColor: colors.interactive.primary,
    borderColor: colors.interactive.primary,
  },
  aiBtnIcon: {
    fontSize: 16,
    color: colors.text.primary,
  },
  aiBtnText: {
    fontSize: typography.size.base,
    color: colors.text.primary,
    fontWeight: typography.weight.semibold,
  },

  // AI panel
  aiPanel: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    overflow: 'hidden',
  },
  aiPanelHeader: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  aiPanelIcon: {
    width: 22, height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.interactive.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  aiPanelIconText: { color: '#fff', fontSize: 12 },
  aiPanelTitle: {
    flex: 1,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
  },
  aiRefresh: {
    width: 26, height: 26,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.sunken,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  aiRefreshText: { color: colors.text.primary, fontSize: 14 },
  aiPanelCaret: {
    color: colors.text.secondary,
    fontSize: 14,
    paddingHorizontal: spacing[1],
  },
  aiPanelBody: { padding: spacing[3] },
  aiPanelText: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * 1.5,
    marginBottom: spacing[2],
  },
  aiPanelError: {
    color: colors.text.danger,
    fontSize: typography.size.sm,
    lineHeight: typography.size.sm * 1.5,
  },
  aiLoading: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  aiLoadingText: { color: colors.text.secondary, fontStyle: 'italic' },

  // Log
  logCard: {
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    overflow: 'hidden',
  },
  logHeader: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text.secondary,
  },
  empty: {
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[3],
    textAlign: 'center',
    color: colors.text.disabled,
    fontSize: typography.size.sm,
    fontStyle: 'italic',
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
  },
  logRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2.5],
  },
  logRowBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1.5],
  },
  logRowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1.5],
  },
  logRowBordered: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
  },
  statusToggle: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  statusToggleDone: {
    backgroundColor: colors.interactive.primary,
    borderColor: colors.interactive.primary,
  },
  statusToggleMark: { color: '#fff', fontSize: 14, fontWeight: typography.weight.bold },
  logRowText: {
    flex: 1,
    fontSize: typography.size.base,
    color: colors.text.primary,
  },
  logRowTextDone: {
    color: colors.text.disabled,
    textDecorationLine: 'line-through',
  },

  // Pills (in row)
  salePill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.status.saleBg,
  },
  salePillText: {
    color: colors.status.saleText,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  acctPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.status.todayBg,
  },
  acctPillText: { color: colors.status.todayText, fontSize: typography.size.xs },
  contPill: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.status.customerBg,
  },
  contPillText: { color: colors.status.customerText, fontSize: typography.size.xs },

  // Upcoming section
  upcomingSection: {
    marginTop: spacing[3],
    paddingHorizontal: spacing[3],
    gap: spacing[2],
    paddingBottom: spacing[4],
  },
  upcomingTitle: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing[1],
  },
  upcomingEmpty: {
    fontSize: typography.size.sm,
    color: colors.text.disabled,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[2],
  },
  upcomingRow: {
    flexDirection: 'row',
    gap: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    borderRadius: radius.md,
  },
  upcomingDateCol: {
    minWidth: 64,
    gap: 2,
  },
  upcomingDate: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  upcomingRelative: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  upcomingBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing[1.5],
  },
  upcomingText: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  upcomingMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1.5],
  },

  kebabBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -2,
  },
  kebabBtnText: {
    color: colors.text.secondary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },

  // Add row
  addRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
  },
  addPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.sunken,
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  addPillText: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
  },

  // Edit panel
  editPanel: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
    backgroundColor: colors.bg.sunken,
    padding: spacing[3],
  },
  editTextarea: {
    backgroundColor: colors.form.inputBg,
    borderWidth: 1,
    borderColor: colors.form.inputFocusBorder,
    borderRadius: radius.sm,
    padding: spacing[2],
    color: colors.form.inputText,
    fontSize: typography.size.base,
    minHeight: 76,
    textAlignVertical: 'top',
  },
  statusRow: {
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  statusRowLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginRight: spacing[1],
  },
  statusChip: {
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  statusChipActiveTodo: {
    backgroundColor: colors.status.todayBg,
    borderColor: colors.interactive.primary,
  },
  statusChipActiveDone: {
    backgroundColor: colors.status.customerBg,
    borderColor: colors.status.customerText,
  },
  statusChipText: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },
  statusChipActiveText: {
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
  },
  editAmountRow: {
    marginTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.bg.canvas,
    borderWidth: 1,
    borderColor: colors.status.saleBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  editAmountIcon: {
    color: colors.status.saleText,
    fontSize: typography.size.md,
  },
  editAmountInput: {
    flex: 1,
    color: colors.form.inputText,
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
  removeLink: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  editRule: {
    fontSize: typography.size.xs,
    color: colors.status.saleText,
    marginTop: spacing[1],
    marginHorizontal: 2,
  },
  editRuleErr: { color: colors.text.danger },

  editChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1] + 2,
    marginTop: spacing[3],
  },
  acctChip: {
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.status.todayBg,
  },
  acctChipText: { color: colors.status.todayText, fontSize: typography.size.xs },
  contChip: {
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.status.customerBg,
  },
  contChipText: { color: colors.status.customerText, fontSize: typography.size.xs },

  editAddChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1] + 2,
    marginTop: spacing[2],
  },
  editAddChip: {
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  editAddChipText: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },

  editActions: {
    flexDirection: 'row',
    gap: spacing[2],
    marginTop: spacing[3.5],
    alignItems: 'center',
  },
  editActionsDelete: { marginRight: 'auto' },
  blockedHint: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: spacing[2],
    marginHorizontal: 2,
  },

  // Bottom buttons
  bottomRow: { flexDirection: 'row', gap: spacing[3] },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3.5],
    alignItems: 'center',
    gap: spacing[3],
    ...shadows.sm,
  },
  bottomBtnPressed: {
    backgroundColor: colors.bg.raised,
    transform: [{ scale: 0.98 }],
  },
  bottomBtnIcon: {
    width: 44, height: 44,
    borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  bottomBtnIconText: { fontSize: 20 },
  bottomBtnTextCol: { flex: 1, minWidth: 0 },
  bottomBtnTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  bottomBtnSub: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginTop: spacing[0.5],
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
    padding: spacing[4],
  },
  modalSheet: {
    backgroundColor: colors.bg.sunken,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  modalTitle: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
    color: colors.text.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  modalBody: { padding: spacing[3] },
  modalRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  modalRowIcon: {
    width: 24, height: 24,
    borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
  modalRowText: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  modalRowSub: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  modalSection: {
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
    paddingBottom: spacing[1],
    fontSize: typography.size.xs,
    color: colors.text.disabled,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    backgroundColor: colors.bg.surface,
  },
  modalCancel: {
    paddingVertical: spacing[3],
    backgroundColor: colors.bg.surface,
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.text.secondary, fontSize: typography.size.sm },
  modalSearchRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  modalSearch: {
    backgroundColor: colors.form.inputBg,
    borderWidth: 0.5,
    borderColor: colors.form.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.form.inputText,
    fontSize: typography.size.sm,
  },
  modalActions: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    gap: spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  modalScroll: { maxHeight: 320 },
  modalListRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  modalListRowDisabled: { opacity: 0.45 },
  modalRowTextDisabled: { color: colors.text.disabled },
  contactRowText: { flex: 1, minWidth: 0, gap: 2 },
  contactRowIcons: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  contactRowAccount: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.regular,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[2],
  },
  sortLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortBtn: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  sortBtnActive: {
    borderColor: colors.interactive.primary,
    backgroundColor: colors.interactive.primary,
  },
  sortBtnText: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  sortBtnTextActive: {
    color: '#fff',
    fontWeight: typography.weight.semibold,
  },
  filterChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  filterChipActive: {
    backgroundColor: colors.status.todayBg,
    borderColor: colors.interactive.primary,
  },
  filterChipText: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  filterChipTextActive: {
    color: colors.status.todayText,
    fontWeight: typography.weight.medium,
  },
  prospectTag: {
    fontSize: typography.size.xs,
    marginRight: spacing[1],
  },
  modalListDate: {
    fontSize: typography.size.xs,
    color: colors.text.disabled,
  },
  modalListDateCol: {
    alignItems: 'flex-end',
    gap: 1,
  },
  modalListDateNext: {
    fontSize: typography.size.xs,
    color: colors.text.link,
  },
  modalListDateLast: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },

  stubText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
    fontStyle: 'italic',
    lineHeight: typography.size.sm * 1.5,
  },
});