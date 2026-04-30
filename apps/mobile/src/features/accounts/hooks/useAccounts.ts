import { useMemo } from 'react';
import { useDataStore } from '../../../stores/dataStore';
import { isProspect, getLastInteractionDate } from '@brybo/shared';
import type { Account } from '@brybo/shared';

export interface AccountWithMeta extends Account {
  isProspect: boolean;
  lastInteractionDate: string | null;
}

export function useAccounts(): AccountWithMeta[] {
  const accounts = useDataStore((s) => s.accounts);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const events = useDataStore((s) => s.events);
  const days = useDataStore((s) => s.days);

  return useMemo(() => {
    return accounts
      .map((a) => ({
        ...a,
        isProspect: isProspect(a.id, eventAccounts, events),
        lastInteractionDate: getLastInteractionDate(a.id, eventAccounts, events, days),
      }))
      .sort((a, b) => {
        if (a.lastInteractionDate && b.lastInteractionDate) {
          return b.lastInteractionDate.localeCompare(a.lastInteractionDate);
        }
        if (a.lastInteractionDate) return -1;
        if (b.lastInteractionDate) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [accounts, eventAccounts, events, days]);
}

export function useAccount(id: string): AccountWithMeta | null {
  const accounts = useAccounts();
  return useMemo(() => accounts.find((a) => a.id === id) ?? null, [accounts, id]);
}
