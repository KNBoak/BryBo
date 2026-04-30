import { useMemo } from 'react';
import { useDataStore } from '../../../stores/dataStore';
import { getContactLastInteractionDate, fullName } from '@brybo/shared';
import type { Contact } from '@brybo/shared';

export interface ContactWithMeta extends Contact {
  lastInteractionDate: string | null;
  accountName: string | null;
}

export function useContacts(): ContactWithMeta[] {
  const contacts = useDataStore((s) => s.contacts);
  const eventContacts = useDataStore((s) => s.eventContacts);
  const events = useDataStore((s) => s.events);
  const days = useDataStore((s) => s.days);
  const accounts = useDataStore((s) => s.accounts);

  return useMemo(() => {
    return contacts
      .map((c) => ({
        ...c,
        lastInteractionDate: getContactLastInteractionDate(c.id, eventContacts, events, days),
        accountName: accounts.find((a) => a.id === c.account_id)?.name ?? null,
      }))
      .sort((a, b) => {
        if (a.lastInteractionDate && b.lastInteractionDate) {
          return b.lastInteractionDate.localeCompare(a.lastInteractionDate);
        }
        if (a.lastInteractionDate) return -1;
        if (b.lastInteractionDate) return 1;
        return fullName(a.first_name, a.last_name).localeCompare(fullName(b.first_name, b.last_name));
      });
  }, [contacts, eventContacts, events, days, accounts]);
}

export function useContact(id: string): ContactWithMeta | null {
  const contacts = useContacts();
  return useMemo(() => contacts.find((c) => c.id === id) ?? null, [contacts, id]);
}

export function useContactsForAccount(accountId: string): ContactWithMeta[] {
  const contacts = useContacts();
  return useMemo(() => contacts.filter((c) => c.account_id === accountId), [contacts, accountId]);
}
