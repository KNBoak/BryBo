import type {
  User,
  Day,
  Account,
  Contact,
  ContactMethod,
  Event,
  EventAccount,
  EventContact,
} from '../types/entities';

export type StorageResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface LocalSnapshot {
  users: User[];
  days: Day[];
  accounts: Account[];
  contacts: Contact[];
  contactMethods: ContactMethod[];
  events: Event[];
  eventAccounts: EventAccount[];
  eventContacts: EventContact[];
  exportedAt: string;
}

export interface StorageAdapter {
  // Users
  getUsers(): Promise<StorageResult<User[]>>;
  getUserById(id: string): Promise<StorageResult<User | null>>;
  saveUser(user: User): Promise<StorageResult<User>>;
  deleteUser(id: string): Promise<StorageResult<void>>;

  // Days
  getDays(userId: string): Promise<StorageResult<Day[]>>;
  getDayById(id: string): Promise<StorageResult<Day | null>>;
  getDayByDate(userId: string, date: string): Promise<StorageResult<Day | null>>;
  saveDay(day: Day): Promise<StorageResult<Day>>;
  deleteDay(id: string): Promise<StorageResult<void>>;

  // Accounts
  getAccounts(userId: string): Promise<StorageResult<Account[]>>;
  getAccountById(id: string): Promise<StorageResult<Account | null>>;
  saveAccount(account: Account): Promise<StorageResult<Account>>;
  deleteAccount(id: string): Promise<StorageResult<void>>;

  // Contacts
  getContacts(userId: string): Promise<StorageResult<Contact[]>>;
  getContactById(id: string): Promise<StorageResult<Contact | null>>;
  getContactsByAccount(accountId: string): Promise<StorageResult<Contact[]>>;
  saveContact(contact: Contact): Promise<StorageResult<Contact>>;
  deleteContact(id: string): Promise<StorageResult<void>>;

  // ContactMethods
  getContactMethods(contactId: string): Promise<StorageResult<ContactMethod[]>>;
  saveContactMethod(cm: ContactMethod): Promise<StorageResult<ContactMethod>>;
  deleteContactMethod(id: string): Promise<StorageResult<void>>;
  replaceContactMethods(
    contactId: string,
    methods: ContactMethod[],
  ): Promise<StorageResult<ContactMethod[]>>;

  // Events
  getEvents(userId: string): Promise<StorageResult<Event[]>>;
  getEventById(id: string): Promise<StorageResult<Event | null>>;
  getEventsByDay(dayId: string): Promise<StorageResult<Event[]>>;
  saveEvent(event: Event): Promise<StorageResult<Event>>;
  deleteEvent(id: string): Promise<StorageResult<void>>;

  // EventAccounts
  getEventAccounts(eventId: string): Promise<StorageResult<EventAccount[]>>;
  getAccountEvents(accountId: string): Promise<StorageResult<EventAccount[]>>;
  replaceEventAccounts(
    eventId: string,
    accountIds: string[],
  ): Promise<StorageResult<EventAccount[]>>;
  deleteEventAccountsForEvent(eventId: string): Promise<StorageResult<void>>;
  deleteEventAccountsForAccount(accountId: string): Promise<StorageResult<void>>;

  // EventContacts
  getEventContacts(eventId: string): Promise<StorageResult<EventContact[]>>;
  getContactEvents(contactId: string): Promise<StorageResult<EventContact[]>>;
  replaceEventContacts(
    eventId: string,
    contactIds: string[],
  ): Promise<StorageResult<EventContact[]>>;
  deleteEventContactsForEvent(eventId: string): Promise<StorageResult<void>>;
  deleteEventContactsForContact(contactId: string): Promise<StorageResult<void>>;

  // Housekeeping
  clearUserData(userId: string): Promise<StorageResult<void>>;
  exportAll(userId: string): Promise<StorageResult<LocalSnapshot>>;

  // Active user persistence
  getActiveUserId(): Promise<StorageResult<string | null>>;
  setActiveUserId(userId: string | null): Promise<StorageResult<void>>;
}
