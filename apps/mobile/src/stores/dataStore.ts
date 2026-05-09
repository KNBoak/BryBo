import { create } from 'zustand';
import type {
  User,
  Day,
  Account,
  Contact,
  ContactMethod,
  Event,
  EventAccount,
  EventContact,
  StorageAdapter,
} from '@brybo/shared';
import { logInfo, logWarn, logError } from '../utils/debug';
import { seedAlMarIfMissing } from '../seeds/almarSeed';

const TAG = 'DataStore';

interface DataState {
  // entities
  users: User[];
  days: Day[];
  accounts: Account[];
  contacts: Contact[];
  contactMethods: ContactMethod[];
  events: Event[];
  eventAccounts: EventAccount[];
  eventContacts: EventContact[];

  activeUserId: string | null;
  _storage: StorageAdapter | null;
  _initialized: boolean;

  // lifecycle
  init: (storage: StorageAdapter) => Promise<void>;
  setActiveUser: (userId: string) => Promise<void>;
  clearActiveUser: () => Promise<void>;

  // users
  upsertUser: (user: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;

  // days
  upsertDay: (day: Day) => Promise<void>;
  _ingestDay: (day: Day) => void;

  // accounts
  upsertAccount: (account: Account) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  // contacts
  upsertContact: (contact: Contact, methods: ContactMethod[]) => Promise<void>;
  deleteContact: (id: string) => Promise<void>;

  // events
  upsertEvent: (event: Event, accountIds: string[], contactIds: string[]) => Promise<void>;
  cancelEvent: (id: string) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

export const useDataStore = create<DataState>((set, get) => ({
  users: [],
  days: [],
  accounts: [],
  contacts: [],
  contactMethods: [],
  events: [],
  eventAccounts: [],
  eventContacts: [],
  activeUserId: null,
  _storage: null,
  _initialized: false,

  init: async (storage) => {
    logInfo(TAG, 'init() start');
    try {
      // Ensure the Al-Mar demo profile exists alongside whatever the user
      // has already created. Idempotent — bails out if Al-Mar is already there.
      const seeded = await seedAlMarIfMissing();
      logInfo(TAG, 'seedAlMarIfMissing result', { seeded });

      logInfo(TAG, 'Reading users from storage...');
      const usersRes = await storage.getUsers();
      logInfo(TAG, 'getUsers result', { ok: usersRes.ok, count: usersRes.ok ? usersRes.data.length : 'err' });

      // Always start at the profile-select screen, even if a previous user was
      // active. setActiveUser() loads that user's data on demand.
      set({
        _storage: storage,
        activeUserId: null,
        users: usersRes.ok ? usersRes.data : [],
        _initialized: true,
      });
      logInfo(TAG, 'init() complete');
    } catch (e) {
      logError(TAG, 'init() threw an exception', e);
      set({ _initialized: true });
    }
  },

  setActiveUser: async (userId) => {
    logInfo(TAG, 'setActiveUser()', { userId });
    const { _storage } = get();
    if (!_storage) {
      logWarn(TAG, 'setActiveUser: _storage is null — aborting');
      return;
    }
    try {
      logInfo(TAG, 'Persisting activeUserId to storage...');
      await _storage.setActiveUserId(userId);
      logInfo(TAG, 'Loading snapshot for user...');
      const snapshot = await _storage.exportAll(userId);
      logInfo(TAG, 'exportAll result', { ok: snapshot.ok });
      const usersRes = await _storage.getUsers();
      logInfo(TAG, 'getUsers result', { ok: usersRes.ok });
      set({
        activeUserId: userId,
        users: usersRes.ok ? usersRes.data : [],
        days: snapshot.ok ? snapshot.data.days : [],
        accounts: snapshot.ok ? snapshot.data.accounts : [],
        contacts: snapshot.ok ? snapshot.data.contacts : [],
        contactMethods: snapshot.ok ? snapshot.data.contactMethods : [],
        events: snapshot.ok ? snapshot.data.events : [],
        eventAccounts: snapshot.ok ? snapshot.data.eventAccounts : [],
        eventContacts: snapshot.ok ? snapshot.data.eventContacts : [],
      });
      logInfo(TAG, 'setActiveUser() complete');
    } catch (e) {
      logError(TAG, 'setActiveUser() threw', e);
    }
  },

  clearActiveUser: async () => {
    logInfo(TAG, 'clearActiveUser()');
    const { _storage } = get();
    if (_storage) await _storage.setActiveUserId(null);
    set({
      activeUserId: null,
      days: [],
      accounts: [],
      contacts: [],
      contactMethods: [],
      events: [],
      eventAccounts: [],
      eventContacts: [],
    });
  },

  upsertUser: async (user) => {
    logInfo(TAG, 'upsertUser()', { id: user.id, name: user.name });
    const { _storage } = get();
    set((s) => ({
      users: s.users.some((u) => u.id === user.id)
        ? s.users.map((u) => (u.id === user.id ? user : u))
        : [...s.users, user],
    }));
    if (!_storage) {
      logWarn(TAG, 'upsertUser: _storage is null — optimistic update only, not persisted');
      return;
    }
    logInfo(TAG, 'upsertUser: optimistic update done, saving to storage...');
    try {
      const res = await _storage.saveUser(user);
      logInfo(TAG, 'saveUser result', res);
    } catch (e) {
      logError(TAG, 'saveUser threw', e);
    }
  },

  deleteUser: async (id) => {
    logInfo(TAG, 'deleteUser()', { id });
    const { _storage } = get();
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
    await _storage?.deleteUser(id);
    await _storage?.clearUserData(id);
  },

  upsertDay: async (day) => {
    logInfo(TAG, 'upsertDay()', { id: day.id, date: day.date });
    const { _storage } = get();
    get()._ingestDay(day);
    try {
      await _storage?.saveDay(day);
    } catch (e) {
      logError(TAG, 'upsertDay: saveDay threw', e);
    }
  },

  _ingestDay: (day) => {
    set((s) => ({
      days: s.days.some((d) => d.id === day.id)
        ? s.days.map((d) => (d.id === day.id ? day : d))
        : [...s.days, day],
    }));
  },

  upsertAccount: async (account) => {
    logInfo(TAG, 'upsertAccount()', { id: account.id, name: account.name });
    const { _storage } = get();
    set((s) => ({
      accounts: s.accounts.some((a) => a.id === account.id)
        ? s.accounts.map((a) => (a.id === account.id ? account : a))
        : [...s.accounts, account],
    }));
    try {
      await _storage?.saveAccount(account);
    } catch (e) {
      logError(TAG, 'upsertAccount: saveAccount threw', e);
    }
  },

  deleteAccount: async (id) => {
    logInfo(TAG, 'deleteAccount()', { id });
    const { _storage, contacts } = get();
    const affectedContactIds = contacts.filter((c) => c.account_id === id).map((c) => c.id);
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
      contacts: s.contacts.map((c) => (c.account_id === id ? { ...c, account_id: null } : c)),
      eventAccounts: s.eventAccounts.filter((ea) => ea.account_id !== id),
    }));
    await _storage?.deleteAccount(id);
    await _storage?.deleteEventAccountsForAccount(id);
    const updatedContacts = get().contacts;
    for (const cId of affectedContactIds) {
      const updated = updatedContacts.find((c) => c.id === cId);
      if (updated) await _storage?.saveContact(updated);
    }
  },

  upsertContact: async (contact, methods) => {
    logInfo(TAG, 'upsertContact()', { id: contact.id });
    const { _storage } = get();
    const previous = get().contacts.find((c) => c.id === contact.id);
    const orphanedAccountId =
      previous && previous.account_id && previous.account_id !== contact.account_id
        ? previous.account_id
        : null;
    const now = new Date().toISOString();
    const accountsToUpdate = orphanedAccountId
      ? get().accounts.filter(
          (a) => a.id === orphanedAccountId && a.primary_contact_id === contact.id,
        )
      : [];

    set((s) => ({
      contacts: s.contacts.some((c) => c.id === contact.id)
        ? s.contacts.map((c) => (c.id === contact.id ? contact : c))
        : [...s.contacts, contact],
      contactMethods: [
        ...s.contactMethods.filter((m) => m.contact_id !== contact.id),
        ...methods,
      ],
      accounts: accountsToUpdate.length === 0
        ? s.accounts
        : s.accounts.map((a) =>
            accountsToUpdate.some((u) => u.id === a.id)
              ? { ...a, primary_contact_id: null, updated_at: now }
              : a,
          ),
    }));
    try {
      await _storage?.saveContact(contact);
      await _storage?.replaceContactMethods(contact.id, methods);
      for (const a of accountsToUpdate) {
        await _storage?.saveAccount({ ...a, primary_contact_id: null, updated_at: now });
      }
    } catch (e) {
      logError(TAG, 'upsertContact: storage threw', e);
    }
  },

  deleteContact: async (id) => {
    logInfo(TAG, 'deleteContact()', { id });
    const { _storage } = get();
    const accountsToUpdate = get().accounts.filter((a) => a.primary_contact_id === id);
    const now = new Date().toISOString();
    set((s) => ({
      contacts: s.contacts.filter((c) => c.id !== id),
      contactMethods: s.contactMethods.filter((m) => m.contact_id !== id),
      eventContacts: s.eventContacts.filter((ec) => ec.contact_id !== id),
      accounts: s.accounts.map((a) =>
        a.primary_contact_id === id
          ? { ...a, primary_contact_id: null, updated_at: now }
          : a,
      ),
    }));
    await _storage?.deleteContact(id);
    await _storage?.replaceContactMethods(id, []);
    await _storage?.deleteEventContactsForContact(id);
    for (const a of accountsToUpdate) {
      await _storage?.saveAccount({ ...a, primary_contact_id: null, updated_at: now });
    }
  },

  upsertEvent: async (event, accountIds, contactIds) => {
    logInfo(TAG, 'upsertEvent()', { id: event.id, type: event.type, accountIds, contactIds });
    const { _storage, accounts } = get();
    const newEA: EventAccount[] = accountIds.map((account_id) => ({ event_id: event.id, account_id }));
    const newEC: EventContact[] = contactIds.map((contact_id) => ({ event_id: event.id, contact_id }));

    // When a non-cancelled sale is logged, automatically promote any linked
    // prospect account to "customer". This keeps the badge from going stale
    // without forcing the user to flip it manually.
    const isLiveSale = !event.is_cancelled && event.amount != null && event.amount > 0;
    const accountsToPromote = isLiveSale
      ? accounts.filter((a) => accountIds.includes(a.id) && a.is_prospect)
      : [];

    set((s) => ({
      events: s.events.some((e) => e.id === event.id)
        ? s.events.map((e) => (e.id === event.id ? event : e))
        : [...s.events, event],
      eventAccounts: [...s.eventAccounts.filter((ea) => ea.event_id !== event.id), ...newEA],
      eventContacts: [...s.eventContacts.filter((ec) => ec.event_id !== event.id), ...newEC],
      accounts: accountsToPromote.length > 0
        ? s.accounts.map((a) =>
            accountsToPromote.some((p) => p.id === a.id)
              ? { ...a, is_prospect: false, updated_at: event.updated_at }
              : a,
          )
        : s.accounts,
    }));
    try {
      await _storage?.saveEvent(event);
      await _storage?.replaceEventAccounts(event.id, accountIds);
      await _storage?.replaceEventContacts(event.id, contactIds);
      for (const a of accountsToPromote) {
        await _storage?.saveAccount({ ...a, is_prospect: false, updated_at: event.updated_at });
      }
    } catch (e) {
      logError(TAG, 'upsertEvent: storage threw', e);
    }
  },

  cancelEvent: async (id) => {
    logInfo(TAG, 'cancelEvent()', { id });
    const { _storage, events } = get();
    const event = events.find((e) => e.id === id);
    if (!event) { logWarn(TAG, 'cancelEvent: event not found'); return; }
    const updated: Event = { ...event, is_cancelled: true, updated_at: new Date().toISOString() };
    set((s) => ({ events: s.events.map((e) => (e.id === id ? updated : e)) }));
    await _storage?.saveEvent(updated);
  },

  deleteEvent: async (id) => {
    logInfo(TAG, 'deleteEvent()', { id });
    const { _storage } = get();
    set((s) => ({
      events: s.events.filter((e) => e.id !== id),
      eventAccounts: s.eventAccounts.filter((ea) => ea.event_id !== id),
      eventContacts: s.eventContacts.filter((ec) => ec.event_id !== id),
    }));
    await _storage?.deleteEvent(id);
    await _storage?.deleteEventAccountsForEvent(id);
    await _storage?.deleteEventContactsForEvent(id);
  },
}));
