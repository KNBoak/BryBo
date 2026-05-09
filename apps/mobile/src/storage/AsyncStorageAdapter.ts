import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  StorageAdapter,
  StorageResult,
  LocalSnapshot,
} from '@brybo/shared';
import type {
  User,
  Day,
  Account,
  Contact,
  ContactMethod,
  Event,
  EventAccount,
  EventContact,
} from '@brybo/shared';
import { logInfo, logError } from '../utils/debug';

const TAG = 'AsyncStorage';

const KEYS = {
  users: 'brybo_users',
  days: 'brybo_days',
  accounts: 'brybo_accounts',
  contacts: 'brybo_contacts',
  contactMethods: 'brybo_contactMethods',
  events: 'brybo_events',
  eventAccounts: 'brybo_eventAccounts',
  eventContacts: 'brybo_eventContacts',
  activeUserId: 'brybo_activeUserId',
} as const;

async function readArray<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  return JSON.parse(raw) as T[];
}

async function writeArray<T>(key: string, data: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(data));
}

function normalizeAccount(a: Account): Account {
  // Default newly added optional-on-disk fields so the runtime contract
  // matches the type when reading older snapshots.
  return {
    ...a,
    primary_contact_id: a.primary_contact_id ?? null,
  };
}

function ok<T>(data: T): StorageResult<T> {
  return { ok: true, data };
}

function err<T>(error: unknown): StorageResult<T> {
  return { ok: false, error: String(error) };
}

export class AsyncStorageAdapter implements StorageAdapter {
  // ── Users ────────────────────────────────────────────────────────────────
  async getUsers(): Promise<StorageResult<User[]>> {
    logInfo(TAG, 'getUsers: reading from AsyncStorage');
    try {
      const users = await readArray<User>(KEYS.users);
      logInfo(TAG, 'getUsers: result', { count: users.length });
      return ok(users);
    } catch (e) {
      logError(TAG, 'getUsers threw', e);
      return err(e);
    }
  }

  async getUserById(id: string): Promise<StorageResult<User | null>> {
    try {
      const all = await readArray<User>(KEYS.users);
      return ok(all.find((u) => u.id === id) ?? null);
    } catch (e) {
      return err(e);
    }
  }

  async saveUser(user: User): Promise<StorageResult<User>> {
    logInfo(TAG, 'saveUser', { id: user.id, name: user.name });
    try {
      const all = await readArray<User>(KEYS.users);
      const idx = all.findIndex((u) => u.id === user.id);
      if (idx >= 0) all[idx] = user;
      else all.push(user);
      await writeArray(KEYS.users, all);
      logInfo(TAG, 'saveUser: done', { totalUsers: all.length });
      return ok(user);
    } catch (e) {
      logError(TAG, 'saveUser threw', e);
      return err(e);
    }
  }

  async deleteUser(id: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<User>(KEYS.users);
      await writeArray(KEYS.users, all.filter((u) => u.id !== id));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  // ── Days ─────────────────────────────────────────────────────────────────
  async getDays(userId: string): Promise<StorageResult<Day[]>> {
    try {
      const all = await readArray<Day>(KEYS.days);
      return ok(all.filter((d) => d.user_id === userId));
    } catch (e) {
      return err(e);
    }
  }

  async getDayById(id: string): Promise<StorageResult<Day | null>> {
    try {
      const all = await readArray<Day>(KEYS.days);
      return ok(all.find((d) => d.id === id) ?? null);
    } catch (e) {
      return err(e);
    }
  }

  async getDayByDate(userId: string, date: string): Promise<StorageResult<Day | null>> {
    try {
      const all = await readArray<Day>(KEYS.days);
      return ok(all.find((d) => d.user_id === userId && d.date === date) ?? null);
    } catch (e) {
      return err(e);
    }
  }

  async saveDay(day: Day): Promise<StorageResult<Day>> {
    try {
      const all = await readArray<Day>(KEYS.days);
      const idx = all.findIndex((d) => d.id === day.id);
      if (idx >= 0) all[idx] = day;
      else all.push(day);
      await writeArray(KEYS.days, all);
      return ok(day);
    } catch (e) {
      return err(e);
    }
  }

  async deleteDay(id: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<Day>(KEYS.days);
      await writeArray(KEYS.days, all.filter((d) => d.id !== id));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  // ── Accounts ─────────────────────────────────────────────────────────────
  async getAccounts(userId: string): Promise<StorageResult<Account[]>> {
    try {
      const all = await readArray<Account>(KEYS.accounts);
      return ok(all.filter((a) => a.user_id === userId).map(normalizeAccount));
    } catch (e) {
      return err(e);
    }
  }

  async getAccountById(id: string): Promise<StorageResult<Account | null>> {
    try {
      const all = await readArray<Account>(KEYS.accounts);
      const account = all.find((a) => a.id === id) ?? null;
      return ok(account ? normalizeAccount(account) : null);
    } catch (e) {
      return err(e);
    }
  }

  async saveAccount(account: Account): Promise<StorageResult<Account>> {
    try {
      const all = await readArray<Account>(KEYS.accounts);
      const idx = all.findIndex((a) => a.id === account.id);
      if (idx >= 0) all[idx] = account;
      else all.push(account);
      await writeArray(KEYS.accounts, all);
      return ok(account);
    } catch (e) {
      return err(e);
    }
  }

  async deleteAccount(id: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<Account>(KEYS.accounts);
      await writeArray(KEYS.accounts, all.filter((a) => a.id !== id));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  // ── Contacts ─────────────────────────────────────────────────────────────
  async getContacts(userId: string): Promise<StorageResult<Contact[]>> {
    try {
      const all = await readArray<Contact>(KEYS.contacts);
      return ok(all.filter((c) => c.user_id === userId));
    } catch (e) {
      return err(e);
    }
  }

  async getContactById(id: string): Promise<StorageResult<Contact | null>> {
    try {
      const all = await readArray<Contact>(KEYS.contacts);
      return ok(all.find((c) => c.id === id) ?? null);
    } catch (e) {
      return err(e);
    }
  }

  async getContactsByAccount(accountId: string): Promise<StorageResult<Contact[]>> {
    try {
      const all = await readArray<Contact>(KEYS.contacts);
      return ok(all.filter((c) => c.account_id === accountId));
    } catch (e) {
      return err(e);
    }
  }

  async saveContact(contact: Contact): Promise<StorageResult<Contact>> {
    try {
      const all = await readArray<Contact>(KEYS.contacts);
      const idx = all.findIndex((c) => c.id === contact.id);
      if (idx >= 0) all[idx] = contact;
      else all.push(contact);
      await writeArray(KEYS.contacts, all);
      return ok(contact);
    } catch (e) {
      return err(e);
    }
  }

  async deleteContact(id: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<Contact>(KEYS.contacts);
      await writeArray(KEYS.contacts, all.filter((c) => c.id !== id));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  // ── ContactMethods ────────────────────────────────────────────────────────
  async getContactMethods(contactId: string): Promise<StorageResult<ContactMethod[]>> {
    try {
      const all = await readArray<ContactMethod>(KEYS.contactMethods);
      return ok(all.filter((m) => m.contact_id === contactId));
    } catch (e) {
      return err(e);
    }
  }

  async saveContactMethod(cm: ContactMethod): Promise<StorageResult<ContactMethod>> {
    try {
      const all = await readArray<ContactMethod>(KEYS.contactMethods);
      const idx = all.findIndex((m) => m.id === cm.id);
      if (idx >= 0) all[idx] = cm;
      else all.push(cm);
      await writeArray(KEYS.contactMethods, all);
      return ok(cm);
    } catch (e) {
      return err(e);
    }
  }

  async deleteContactMethod(id: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<ContactMethod>(KEYS.contactMethods);
      await writeArray(KEYS.contactMethods, all.filter((m) => m.id !== id));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async replaceContactMethods(
    contactId: string,
    methods: ContactMethod[],
  ): Promise<StorageResult<ContactMethod[]>> {
    try {
      const all = await readArray<ContactMethod>(KEYS.contactMethods);
      const others = all.filter((m) => m.contact_id !== contactId);
      await writeArray(KEYS.contactMethods, [...others, ...methods]);
      return ok(methods);
    } catch (e) {
      return err(e);
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────
  async getEvents(userId: string): Promise<StorageResult<Event[]>> {
    try {
      const all = await readArray<Event>(KEYS.events);
      return ok(all.filter((e) => e.user_id === userId));
    } catch (e) {
      return err(e);
    }
  }

  async getEventById(id: string): Promise<StorageResult<Event | null>> {
    try {
      const all = await readArray<Event>(KEYS.events);
      return ok(all.find((e) => e.id === id) ?? null);
    } catch (e) {
      return err(e);
    }
  }

  async getEventsByDay(dayId: string): Promise<StorageResult<Event[]>> {
    try {
      const all = await readArray<Event>(KEYS.events);
      return ok(all.filter((e) => e.day_id === dayId));
    } catch (e) {
      return err(e);
    }
  }

  async saveEvent(event: Event): Promise<StorageResult<Event>> {
    try {
      const all = await readArray<Event>(KEYS.events);
      const idx = all.findIndex((e) => e.id === event.id);
      if (idx >= 0) all[idx] = event;
      else all.push(event);
      await writeArray(KEYS.events, all);
      return ok(event);
    } catch (e) {
      return err(e);
    }
  }

  async deleteEvent(id: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<Event>(KEYS.events);
      await writeArray(KEYS.events, all.filter((e) => e.id !== id));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  // ── EventAccounts ─────────────────────────────────────────────────────────
  async getEventAccounts(eventId: string): Promise<StorageResult<EventAccount[]>> {
    try {
      const all = await readArray<EventAccount>(KEYS.eventAccounts);
      return ok(all.filter((ea) => ea.event_id === eventId));
    } catch (e) {
      return err(e);
    }
  }

  async getAccountEvents(accountId: string): Promise<StorageResult<EventAccount[]>> {
    try {
      const all = await readArray<EventAccount>(KEYS.eventAccounts);
      return ok(all.filter((ea) => ea.account_id === accountId));
    } catch (e) {
      return err(e);
    }
  }

  async replaceEventAccounts(
    eventId: string,
    accountIds: string[],
  ): Promise<StorageResult<EventAccount[]>> {
    try {
      const all = await readArray<EventAccount>(KEYS.eventAccounts);
      const others = all.filter((ea) => ea.event_id !== eventId);
      const newRows: EventAccount[] = accountIds.map((account_id) => ({ event_id: eventId, account_id }));
      await writeArray(KEYS.eventAccounts, [...others, ...newRows]);
      return ok(newRows);
    } catch (e) {
      return err(e);
    }
  }

  async deleteEventAccountsForEvent(eventId: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<EventAccount>(KEYS.eventAccounts);
      await writeArray(KEYS.eventAccounts, all.filter((ea) => ea.event_id !== eventId));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async deleteEventAccountsForAccount(accountId: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<EventAccount>(KEYS.eventAccounts);
      await writeArray(KEYS.eventAccounts, all.filter((ea) => ea.account_id !== accountId));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  // ── EventContacts ─────────────────────────────────────────────────────────
  async getEventContacts(eventId: string): Promise<StorageResult<EventContact[]>> {
    try {
      const all = await readArray<EventContact>(KEYS.eventContacts);
      return ok(all.filter((ec) => ec.event_id === eventId));
    } catch (e) {
      return err(e);
    }
  }

  async getContactEvents(contactId: string): Promise<StorageResult<EventContact[]>> {
    try {
      const all = await readArray<EventContact>(KEYS.eventContacts);
      return ok(all.filter((ec) => ec.contact_id === contactId));
    } catch (e) {
      return err(e);
    }
  }

  async replaceEventContacts(
    eventId: string,
    contactIds: string[],
  ): Promise<StorageResult<EventContact[]>> {
    try {
      const all = await readArray<EventContact>(KEYS.eventContacts);
      const others = all.filter((ec) => ec.event_id !== eventId);
      const newRows: EventContact[] = contactIds.map((contact_id) => ({ event_id: eventId, contact_id }));
      await writeArray(KEYS.eventContacts, [...others, ...newRows]);
      return ok(newRows);
    } catch (e) {
      return err(e);
    }
  }

  async deleteEventContactsForEvent(eventId: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<EventContact>(KEYS.eventContacts);
      await writeArray(KEYS.eventContacts, all.filter((ec) => ec.event_id !== eventId));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async deleteEventContactsForContact(contactId: string): Promise<StorageResult<void>> {
    try {
      const all = await readArray<EventContact>(KEYS.eventContacts);
      await writeArray(KEYS.eventContacts, all.filter((ec) => ec.contact_id !== contactId));
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  // ── Housekeeping ──────────────────────────────────────────────────────────
  async clearUserData(userId: string): Promise<StorageResult<void>> {
    try {
      await Promise.all([
        writeArray(KEYS.days, (await readArray<Day>(KEYS.days)).filter((d) => d.user_id !== userId)),
        writeArray(KEYS.accounts, (await readArray<Account>(KEYS.accounts)).filter((a) => a.user_id !== userId)),
        writeArray(KEYS.contacts, (await readArray<Contact>(KEYS.contacts)).filter((c) => c.user_id !== userId)),
        writeArray(KEYS.events, (await readArray<Event>(KEYS.events)).filter((e) => e.user_id !== userId)),
      ]);
      return ok(undefined);
    } catch (e) {
      return err(e);
    }
  }

  async exportAll(userId: string): Promise<StorageResult<LocalSnapshot>> {
    logInfo(TAG, 'exportAll start', { userId });
    try {
      const [users, days, accounts, contacts, contactMethods, events, eventAccounts, eventContacts] =
        await Promise.all([
          readArray<User>(KEYS.users),
          readArray<Day>(KEYS.days),
          readArray<Account>(KEYS.accounts),
          readArray<Contact>(KEYS.contacts),
          readArray<ContactMethod>(KEYS.contactMethods),
          readArray<Event>(KEYS.events),
          readArray<EventAccount>(KEYS.eventAccounts),
          readArray<EventContact>(KEYS.eventContacts),
        ]);

      const userEventIds = new Set(events.filter((e) => e.user_id === userId).map((e) => e.id));
      logInfo(TAG, 'exportAll: data loaded', {
        days: days.filter((d) => d.user_id === userId).length,
        accounts: accounts.filter((a) => a.user_id === userId).length,
        contacts: contacts.filter((c) => c.user_id === userId).length,
        events: events.filter((e) => e.user_id === userId).length,
      });

      return ok({
        users: users.filter((u) => u.id === userId),
        days: days.filter((d) => d.user_id === userId),
        accounts: accounts.filter((a) => a.user_id === userId),
        contacts: contacts.filter((c) => c.user_id === userId),
        contactMethods: contactMethods.filter((m) =>
          contacts.some((c) => c.id === m.contact_id && c.user_id === userId),
        ),
        events: events.filter((e) => e.user_id === userId),
        eventAccounts: eventAccounts.filter((ea) => userEventIds.has(ea.event_id)),
        eventContacts: eventContacts.filter((ec) => userEventIds.has(ec.event_id)),
        exportedAt: new Date().toISOString(),
      });
    } catch (e) {
      logError(TAG, 'exportAll threw', e);
      return err(e);
    }
  }

  // ── Active user ───────────────────────────────────────────────────────────
  async getActiveUserId(): Promise<StorageResult<string | null>> {
    logInfo(TAG, 'getActiveUserId: reading from AsyncStorage');
    try {
      const val = await AsyncStorage.getItem(KEYS.activeUserId);
      logInfo(TAG, 'getActiveUserId: result', { val });
      return ok(val);
    } catch (e) {
      logError(TAG, 'getActiveUserId threw', e);
      return err(e);
    }
  }

  async setActiveUserId(userId: string | null): Promise<StorageResult<void>> {
    logInfo(TAG, 'setActiveUserId', { userId });
    try {
      if (userId === null) {
        await AsyncStorage.removeItem(KEYS.activeUserId);
      } else {
        await AsyncStorage.setItem(KEYS.activeUserId, userId);
      }
      logInfo(TAG, 'setActiveUserId: done');
      return ok(undefined);
    } catch (e) {
      logError(TAG, 'setActiveUserId threw', e);
      return err(e);
    }
  }
}
