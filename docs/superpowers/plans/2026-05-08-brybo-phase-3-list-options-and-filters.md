# BryBo UX Fixes — Phase 3 Implementation Plan (Search/list options dialogs + filters)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 3 of the BryBo UX-fixes spec — replace direct navigation from the account/contact list rows with options dialogs (Open / Add event / linked-entity navigation / per-method "Call" / "Text" / "Email"), add a last-touch filter chip row, and introduce a `primary_contact_id` field on Account so the account dialog can surface the primary contact.

**Architecture:** Reuses the `RowActionsSheet` primitive from Phase 2 for both new options dialogs. Adds `primary_contact_id: string | null` to the Account type with normalization on storage read so existing accounts round-trip cleanly. Adds cleanup in the data store so the field is cleared automatically when the named contact is removed from the account or deleted. Filter chips live in `MainScreen.tsx`'s existing accounts-list and contacts-list Modal blocks; no new components.

**Tech Stack:** React Native + Expo, Zustand store, TypeScript. No test framework — verification is manual via `npm run dev:mobile`.

**Spec:** `docs/superpowers/specs/2026-05-08-brybo-ux-fixes-design.md` (Phase 3 — Search/list options dialogs + Last-touch filter)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `packages/shared/src/types/entities.ts` | Modify | Add `primary_contact_id: string \| null` to `Account` |
| `apps/mobile/src/storage/AsyncStorageAdapter.ts` | Modify | Default missing `primary_contact_id` to `null` on read |
| `apps/mobile/src/stores/dataStore.ts` | Modify | Cleanup: clear `primary_contact_id` when the named contact is removed from the account or deleted |
| `apps/mobile/src/features/main/AccountDetailModal.tsx` | Modify | "Primary" toggle next to each linked-contact row; persists via existing `upsertAccount` |
| `apps/mobile/src/features/main/MainScreen.tsx` | Modify | Replace direct-nav row taps with `account-actions` and `contact-actions` modal kinds rendered via `RowActionsSheet`; add last-touch filter-chip row to both list modals; new `lastTouchFilter` predicate |

---

## Task 1: Add `primary_contact_id` to the Account type with storage normalization

**Files:**
- Modify: `packages/shared/src/types/entities.ts`
- Modify: `apps/mobile/src/storage/AsyncStorageAdapter.ts`

- [ ] **Step 1: Add the field to the `Account` interface**

In `packages/shared/src/types/entities.ts`, find the `Account` interface (around line 26):

```ts
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
```

Add a single field between `is_prospect` and `created_at`:

```ts
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
  /** ID of the contact marked as primary for this account; null if none. */
  primary_contact_id: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Add normalization on storage read**

In `apps/mobile/src/storage/AsyncStorageAdapter.ts`, find `getAccounts` (around line 152) and `getAccountById` (around line 161). Both call `readArray<Account>(KEYS.accounts)` which directly casts the parsed JSON.

Add a small private helper near the top of the file (just below the existing `readArray`/`writeArray` helpers — find them with `grep -n "readArray\|writeArray" apps/mobile/src/storage/AsyncStorageAdapter.ts`):

```ts
function normalizeAccount(a: Account): Account {
  // Default newly added optional-on-disk fields so the runtime contract
  // matches the type when reading older snapshots.
  return {
    ...a,
    primary_contact_id: a.primary_contact_id ?? null,
  };
}
```

Modify `getAccounts` to map the result:

Find:
```ts
  async getAccounts(userId: string): Promise<StorageResult<Account[]>> {
    try {
      const all = await readArray<Account>(KEYS.accounts);
      return ok(all.filter((a) => a.user_id === userId));
    } catch (e) {
      return err(e);
    }
  }
```

Replace with:
```ts
  async getAccounts(userId: string): Promise<StorageResult<Account[]>> {
    try {
      const all = await readArray<Account>(KEYS.accounts);
      return ok(all.filter((a) => a.user_id === userId).map(normalizeAccount));
    } catch (e) {
      return err(e);
    }
  }
```

Modify `getAccountById`:

Find:
```ts
  async getAccountById(id: string): Promise<StorageResult<Account | null>> {
    try {
      const all = await readArray<Account>(KEYS.accounts);
      return ok(all.find((a) => a.id === id) ?? null);
    } catch (e) {
      return err(e);
    }
  }
```

Replace with:
```ts
  async getAccountById(id: string): Promise<StorageResult<Account | null>> {
    try {
      const all = await readArray<Account>(KEYS.accounts);
      const account = all.find((a) => a.id === id) ?? null;
      return ok(account ? normalizeAccount(account) : null);
    } catch (e) {
      return err(e);
    }
  }
```

- [ ] **Step 3: Update the Al-Mar seed data**

The seeded Al-Mar profile (`apps/mobile/src/seeds/almarSeed.ts`) constructs `Account` records inline. Find them with:
```bash
grep -nE "is_prospect" /Users/kevinboak/dev/BryBo/apps/mobile/src/seeds/almarSeed.ts | head -10
```

Each `Account` literal needs `primary_contact_id: null,` added (matching the new required field). Add it on the line after `is_prospect`. Run the grep again afterwards to confirm every `is_prospect` line has a sibling `primary_contact_id`.

Note: the seed uses inline literals — for each `is_prospect: true,` or `is_prospect: false,` line, add `    primary_contact_id: null,` immediately below it (matching indent).

- [ ] **Step 4: Search for any other Account-construction sites**

```bash
grep -rnE "is_prospect:\s*(true|false)," /Users/kevinboak/dev/BryBo/apps/mobile/src /Users/kevinboak/dev/BryBo/packages/shared/src
```

Anywhere TypeScript constructs an Account literal (e.g., `AccountDetailModal.tsx`'s `handleSave`), add `primary_contact_id: existing?.primary_contact_id ?? null,` to preserve any value when editing or default to null when creating. The grep result is your authoritative list — touch every match.

For `AccountDetailModal.tsx`'s `handleSave` specifically (around line 158–180), the new account literal currently is:
```ts
      const account: Account = {
        id: existing?.id ?? generateId(),
        user_id: activeUserId,
        name: draft.name.trim(),
        city: draft.city.trim() || null,
        state: draft.state.trim() || null,
        address: draft.address.trim() || null,
        phone: draft.phone.trim() || null,
        website: draft.website.trim() || null,
        notes: draft.notes.trim() || null,
        is_prospect: draft.is_prospect,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
```
Add a single line `primary_contact_id: existing?.primary_contact_id ?? null,` between `is_prospect` and `created_at`.

- [ ] **Step 5: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```
Expected: passes. If TypeScript flags any other Account literal that's missing the field, add `primary_contact_id: null,` to it (or the appropriate `existing?.primary_contact_id ?? null` if it's an edit-flow context).

- [ ] **Step 6: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add packages/shared/src/types/entities.ts apps/mobile/src/storage/AsyncStorageAdapter.ts apps/mobile/src/seeds/almarSeed.ts apps/mobile/src/features/main/AccountDetailModal.tsx
git commit -m "feat(account): add primary_contact_id field with storage normalization" -- packages/shared/src/types/entities.ts apps/mobile/src/storage/AsyncStorageAdapter.ts apps/mobile/src/seeds/almarSeed.ts apps/mobile/src/features/main/AccountDetailModal.tsx
```

(Adjust the file list if you touched additional files in Step 4. The pathspec MUST cover every file you edited — and ONLY those files.)

---

## Task 2: Cleanup `primary_contact_id` when its target contact is removed

When a contact is deleted entirely, OR when a contact's `account_id` is changed/cleared (effectively removing it from the previous account), any account whose `primary_contact_id` pointed at that contact must have the field cleared.

**Files:**
- Modify: `apps/mobile/src/stores/dataStore.ts`

- [ ] **Step 1: Locate the relevant store actions**

Run:
```bash
grep -nE "deleteContact|upsertContact" /Users/kevinboak/dev/BryBo/apps/mobile/src/stores/dataStore.ts
```
Expected: `upsertContact` around line 229–247 and `deleteContact` around line 249–260.

- [ ] **Step 2: Update `deleteContact`**

In `deleteContact`, add account cleanup. Find:

```ts
  deleteContact: async (id) => {
    logInfo(TAG, 'deleteContact()', { id });
    const { _storage } = get();
    set((s) => ({
      contacts: s.contacts.filter((c) => c.id !== id),
      contactMethods: s.contactMethods.filter((m) => m.contact_id !== id),
      eventContacts: s.eventContacts.filter((ec) => ec.contact_id !== id),
    }));
    await _storage?.deleteContact(id);
    await _storage?.replaceContactMethods(id, []);
    await _storage?.deleteEventContactsForContact(id);
```

Replace the `set(...)` block with one that ALSO clears matching `primary_contact_id`, and persist any affected accounts. The full new body:

```ts
  deleteContact: async (id) => {
    logInfo(TAG, 'deleteContact()', { id });
    const { _storage } = get();
    const accountsBefore = get().accounts;
    const accountsToUpdate = accountsBefore.filter((a) => a.primary_contact_id === id);
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
```

(The closing `}` and any error handling stay as-is. Match the existing function's closing structure exactly — just expand the body.)

- [ ] **Step 3: Update `upsertContact` to clear primary on account-id change**

When a user moves a contact to a different account (or detaches it entirely by setting `account_id` to null), the previous account may have had this contact as primary. Clear it.

In `upsertContact`, find:

```ts
  upsertContact: async (contact, methods) => {
    logInfo(TAG, 'upsertContact()', { id: contact.id });
    const { _storage } = get();
    set((s) => ({
      contacts: s.contacts.some((c) => c.id === contact.id)
        ? s.contacts.map((c) => (c.id === contact.id ? contact : c))
        : [...s.contacts, contact],
      contactMethods: [
        ...s.contactMethods.filter((m) => m.contact_id !== contact.id),
        ...methods,
      ],
    }));
    try {
      await _storage?.saveContact(contact);
      await _storage?.replaceContactMethods(contact.id, methods);
    } catch (e) {
      logError(TAG, 'upsertContact: storage threw', e);
    }
  },
```

Replace with:

```ts
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
```

The `orphanedAccountId` logic detects when a contact's `account_id` has changed away from a previous value, and clears that previous account's primary marker if it was pointing at this contact.

- [ ] **Step 4: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/stores/dataStore.ts
git commit -m "feat(store): clear primary_contact_id when its contact is removed" -- apps/mobile/src/stores/dataStore.ts
```

---

## Task 3: Add a "Primary" toggle to each linked-contact row in `AccountDetailModal`

**Files:**
- Modify: `apps/mobile/src/features/main/AccountDetailModal.tsx`

- [ ] **Step 1: Locate the linked-contacts render block**

Run:
```bash
sed -n '296,335p' /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/AccountDetailModal.tsx
```

You'll see (around lines 296–333) a "Contacts" section that lists `linkedContacts` for the existing account, each rendered as a `Pressable` with `onOpenContact?.(c.id)`.

- [ ] **Step 2: Add a primary state to the modal's `draft`**

Find the `draft` state declaration (search for `const [draft, setDraft]`). It already mirrors most fields of the Account. Add `primary_contact_id` to the initial state shape if it isn't already there. Look at how `is_prospect` is stored:

```bash
grep -nE "is_prospect|primary_contact_id" /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/AccountDetailModal.tsx | head
```

The `draft` likely has `is_prospect: existing?.is_prospect ?? true` or similar. Add a sibling field `primary_contact_id: existing?.primary_contact_id ?? null` initialized the same way. (Check the existing `useState`/`useEffect` reset logic and add the field consistently — likely there's both an initializer and a `setDraft` reset effect.)

Then update `handleSave` (Step 4 of Task 1 already added `primary_contact_id: existing?.primary_contact_id ?? null,` — change that to `draft.primary_contact_id` so the user's changes are persisted):

Find:
```ts
        primary_contact_id: existing?.primary_contact_id ?? null,
```
Replace with:
```ts
        primary_contact_id: draft.primary_contact_id,
```

- [ ] **Step 3: Render the Primary toggle in each linked-contact row**

Inside the `linkedContacts.map((c) => { … })` block (around lines 306–323), the current row is:

```tsx
                    return (
                      <Pressable
                        key={c.id}
                        style={styles.contactRow}
                        onPress={() => onOpenContact?.(c.id)}
                      >
                        <Text style={styles.contactIcon}>👤</Text>
                        <Text style={styles.contactName} numberOfLines={1}>{fullName}</Text>
                        {cell ? <Text style={styles.contactCell}>{cell.value}</Text> : null}
                      </Pressable>
                    );
```

Replace with:

```tsx
                    const isPrimary = draft.primary_contact_id === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={styles.contactRow}
                        onPress={() => onOpenContact?.(c.id)}
                      >
                        <Text style={styles.contactIcon}>👤</Text>
                        <Text style={styles.contactName} numberOfLines={1}>{fullName}</Text>
                        {cell ? <Text style={styles.contactCell}>{cell.value}</Text> : null}
                        <Pressable
                          style={[styles.primaryStar, isPrimary && styles.primaryStarActive]}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={isPrimary ? 'Unmark as primary contact' : 'Mark as primary contact'}
                          onPress={(e) => {
                            e.stopPropagation();
                            setDraft({
                              ...draft,
                              primary_contact_id: isPrimary ? null : c.id,
                            });
                          }}
                        >
                          <Text style={[styles.primaryStarText, isPrimary && styles.primaryStarTextActive]}>★</Text>
                        </Pressable>
                      </Pressable>
                    );
```

The star renders muted by default and tinted when this contact is primary. Tapping it toggles primary on/off (setting one contact as primary automatically unsets the previous, since `primary_contact_id` only holds one id).

- [ ] **Step 4: Add the new styles**

In the file's `StyleSheet.create({...})` block, find a sensible spot near the other `contactRow*` styles and add:

```ts
  primaryStar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryStarActive: {
    backgroundColor: colors.status.todayBg,
  },
  primaryStarText: {
    color: colors.text.disabled,
    fontSize: typography.size.base,
  },
  primaryStarTextActive: {
    color: colors.status.todayText,
  },
```

(`colors.status.todayBg`/`todayText` is the same blue-ish accent palette used for account icons, keeping the visual language consistent.)

- [ ] **Step 5: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```

- [ ] **Step 6: Manually verify**

Run `npm run dev:mobile`. Open an existing account that has linked contacts. Tap the star next to one contact → fills in. Tap a different contact's star → that one fills in, the previous clears. Save the account → re-open → the marked contact's star is still filled. Tap the same star again → unmarks. Save → re-open → no star is filled.

- [ ] **Step 7: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/AccountDetailModal.tsx
git commit -m "feat(account-modal): primary-contact toggle on linked-contact rows" -- apps/mobile/src/features/main/AccountDetailModal.tsx
```

---

## Task 4: Account-options dialog (replace direct nav from accounts list)

**Files:**
- Modify: `apps/mobile/src/features/main/MainScreen.tsx`

- [ ] **Step 1: Add the new modal kind**

Find the modal-state union (around line 328+). After the `'account-detail'` line, add a new sibling kind:

```ts
    | { kind: 'account-detail'; accountId: string | null; selectOnSave?: boolean }
    | { kind: 'account-actions'; accountId: string }
```

- [ ] **Step 2: Change the row-tap handler**

In the accounts-list Modal block (around line 999), find:

```ts
                          onPress={() =>
                            isPick
                              ? selectAccountIntoEditing(a.id)
                              : setModal({ kind: 'account-detail', accountId: a.id })
                          }
```

Replace `setModal({ kind: 'account-detail', accountId: a.id })` with `setModal({ kind: 'account-actions', accountId: a.id })`. Keep the `isPick` branch unchanged — we only intercept the browse-mode tap, not the pick-mode tap.

```ts
                          onPress={() =>
                            isPick
                              ? selectAccountIntoEditing(a.id)
                              : setModal({ kind: 'account-actions', accountId: a.id })
                          }
```

- [ ] **Step 3: Render the dialog**

Add a new render block in the JSX tree (place it just below the existing log-actions block, around line 935 — after the `})()}` closure of the log-actions IIFE):

```tsx
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
```

Notes on the implementation:
- `storeAccounts` and `storeContacts` are already in scope in `MainScreen` — confirm with `grep -n "storeAccounts\|storeContacts" apps/mobile/src/features/main/MainScreen.tsx | head -5`.
- "Add event…" sets `kind: 'event-form'` with `initial: { date: viewDate, accountIds: [account.id] }`. The `EventFormInitial` interface (in `EventFormModal.tsx`) already declares optional `accountIds` and `contactIds` arrays, and the form's reset effect honors them via `setAccountIds(initial.accountIds ?? [])`. No type or form change required.

- [ ] **Step 4: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```
Fix any type errors that surface from `EventFormInitial.accountIds` if needed.

- [ ] **Step 5: Manually verify**

Run the app. Open the accounts list (browse mode). Tap an account → options dialog opens (NOT the account detail). "Open account" routes to the detail screen. "Add event…" opens the event-form with the account pre-linked. If the account has a primary contact set, the "Primary contact" section shows that contact and tapping it routes to the contact detail.

- [ ] **Step 6: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/MainScreen.tsx
git commit -m "feat(accounts-list): account-options dialog replaces direct nav" -- apps/mobile/src/features/main/MainScreen.tsx
```

---

## Task 5: Contact-options dialog (replace direct nav from contacts list, with per-method actions)

**Files:**
- Modify: `apps/mobile/src/features/main/MainScreen.tsx`

- [ ] **Step 1: Add the new modal kind**

In the modal-state union, after the `'contact-detail'` line:

```ts
    | { kind: 'contact-detail'; contactId: string | null; selectOnSave?: boolean; linkToAccountId?: string; returnToAccountId?: string }
    | { kind: 'contact-actions'; contactId: string }
```

- [ ] **Step 2: Change the row-tap handler**

In the contacts-list Modal block (around line 1113), find:

```ts
                          onPress={() => {
                            if (isPick) selectContactIntoEditing(c.id);
                            else if (isLink && linkAccountId) linkContactToAccount(c.id, linkAccountId);
                            else setModal({ kind: 'contact-detail', contactId: c.id });
                          }}
```

Replace the final `else` branch:

```ts
                          onPress={() => {
                            if (isPick) selectContactIntoEditing(c.id);
                            else if (isLink && linkAccountId) linkContactToAccount(c.id, linkAccountId);
                            else setModal({ kind: 'contact-actions', contactId: c.id });
                          }}
```

- [ ] **Step 3: Add a `Linking` import to `MainScreen.tsx` if not already present**

Run:
```bash
grep -nE "^import .*Linking" /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/MainScreen.tsx
```

If `Linking` isn't imported from `react-native`, add it to the existing `react-native` import:

```ts
import { ..., Linking, ... } from 'react-native';
```

- [ ] **Step 4: Render the dialog**

Add a new render block near the account-actions one:

```tsx
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
            // Primary first within a type.
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
              // 'other' — non-tappable display row.
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
```

Notes:
- `storeContactMethods` is already in scope — verify with `grep -n "storeContactMethods" apps/mobile/src/features/main/MainScreen.tsx | head -5`.
- The phone number is sanitized to digits-only for `tel:` and `sms:` URLs (matches the pattern at `ContactDetailModal.tsx:373–374`).
- `EventFormInitial.contactIds` already exists (sibling to `accountIds`). No type change needed.

- [ ] **Step 5: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```

- [ ] **Step 6: Manually verify**

Run the app. Open the contacts list (browse mode). Tap a contact → options dialog opens (NOT the contact detail). "Open contact" routes to the detail. "Add event…" opens the event-form with the contact (and account if linked) pre-filled. If the contact has a linked account, the "Linked account" section shows; tapping the account navigates to the account detail. Each cell phone produces a "Call cell" + "Text cell" row; work/home phones produce one "Call" row each; emails produce one "Email" row. Tapping "Call cell" opens the dialer; "Text cell" opens SMS; "Email" opens mail.

- [ ] **Step 7: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/MainScreen.tsx
git commit -m "feat(contacts-list): contact-options dialog with per-method actions" -- apps/mobile/src/features/main/MainScreen.tsx
```

---

## Task 6: Add the "last touch" filter chip row to both list modals

A single shared chip-band UI on both the accounts and contacts list modals. Single-select. Combines with the existing text search (AND semantics).

**Files:**
- Modify: `apps/mobile/src/features/main/MainScreen.tsx`

- [ ] **Step 1: Add the filter state and reset effect**

Near the other UI state declarations (around line 320, where `accountsSearch` and `contactsSearch` live), add:

```ts
  type LastTouchFilter = 'any' | 'week' | 'month' | 'stale3' | 'stale6' | 'never';
  const [accountsLastTouch, setAccountsLastTouch] = useState<LastTouchFilter>('any');
  const [contactsLastTouch, setContactsLastTouch] = useState<LastTouchFilter>('any');
```

In the existing `React.useEffect(() => { ... }, [modal.kind])` reset block (around line 345), add reset lines for the new state:

```ts
  React.useEffect(() => {
    if (modal.kind !== 'accounts-list') {
      setAccountsSearch('');
      setAccountsLastTouch('any');
    }
    if (modal.kind !== 'contacts-list') {
      setContactsSearch('');
      setContactsLastTouch('any');
    }
  }, [modal.kind]);
```

(Match the existing reset structure and indentation; the additions are the two `setX('any')` calls.)

- [ ] **Step 2: Add a shared predicate helper**

Near the other helpers at the top of the component file (or just above the `MainScreen` function), add a small helper:

```ts
function matchesLastTouch(
  lastInteractionIso: string | null,
  todayIso: string,
  filter: 'any' | 'week' | 'month' | 'stale3' | 'stale6' | 'never',
): boolean {
  if (filter === 'any') return true;
  if (filter === 'never') return lastInteractionIso == null;
  if (lastInteractionIso == null) {
    // Stale filters include never-touched. Recent filters do not.
    return filter === 'stale3' || filter === 'stale6';
  }
  const daysSince = Math.floor(
    (new Date(todayIso + 'T00:00:00').getTime() -
      new Date(lastInteractionIso + 'T00:00:00').getTime()) /
      86_400_000,
  );
  if (filter === 'week') return daysSince <= 7;
  if (filter === 'month') return daysSince <= 30;
  if (filter === 'stale3') return daysSince >= 90;
  if (filter === 'stale6') return daysSince >= 180;
  return true;
}
```

- [ ] **Step 3: Apply the filter inside the accounts-list Modal**

In the accounts-list block (around line 945), find the existing `visibleAccounts` chain:

```ts
              const visibleAccounts = accounts
                .filter((a) => !accountsProspectsOnly || a.isProspect)
                .filter((a) => {
                  if (!q) return true;
                  return (
                    a.name.toLowerCase().includes(q) ||
                    (a.city ?? '').toLowerCase().includes(q)
                  );
                });
```

Append a third filter step:

```ts
              const visibleAccounts = accounts
                .filter((a) => !accountsProspectsOnly || a.isProspect)
                .filter((a) => {
                  if (!q) return true;
                  return (
                    a.name.toLowerCase().includes(q) ||
                    (a.city ?? '').toLowerCase().includes(q)
                  );
                })
                .filter((a) => matchesLastTouch(a.lastInteraction, today, accountsLastTouch));
```

(`today` is already in scope as a top-level helper variable used by the date relative-formatting functions in the same file. Confirm with `grep -n "const today\|today = " apps/mobile/src/features/main/MainScreen.tsx | head`.)

- [ ] **Step 4: Render the chip row in the accounts-list modal**

Find the existing `<View style={styles.modalActions}>` block in the accounts list (around line 972) — that's where the "+ Add new" pill and the "Prospects only" filter chip live. Add a new chip row UNDER that block, before the `<ScrollView>`:

```tsx
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
                  <LastTouchChips value={accountsLastTouch} onChange={setAccountsLastTouch} />
                  <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
```

- [ ] **Step 5: Add the `LastTouchChips` sub-component**

At the bottom of `MainScreen.tsx`, near the `LogRow` and `LogEditPanel` function components, add:

```tsx
function LastTouchChips(props: {
  value: 'any' | 'week' | 'month' | 'stale3' | 'stale6' | 'never';
  onChange: (v: 'any' | 'week' | 'month' | 'stale3' | 'stale6' | 'never') => void;
}) {
  const opts: { key: 'any' | 'week' | 'month' | 'stale3' | 'stale6' | 'never'; label: string }[] = [
    { key: 'any',    label: 'Any' },
    { key: 'week',   label: 'This wk' },
    { key: 'month',  label: 'This mo' },
    { key: 'stale3', label: '3+ mo' },
    { key: 'stale6', label: '6+ mo' },
    { key: 'never',  label: 'Never' },
  ];
  return (
    <View style={styles.lastTouchRow}>
      {opts.map((o) => {
        const active = props.value === o.key;
        return (
          <Pressable
            key={o.key}
            style={[styles.filterChip, active && styles.filterChipActive]}
            onPress={() => props.onChange(o.key)}
          >
            <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

Add a style entry to the `StyleSheet.create({...})` block:

```ts
  lastTouchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1.5],
    paddingHorizontal: spacing[3],
    paddingBottom: spacing[2],
  },
```

(`filterChip`, `filterChipActive`, `filterChipText`, `filterChipTextActive` already exist — confirm with `grep -n "filterChip:" apps/mobile/src/features/main/MainScreen.tsx`.)

- [ ] **Step 6: Apply the same in the contacts-list Modal**

In the contacts-list block (around line 1057), find the existing `visibleContacts` chain:

```ts
              const visibleContacts = q
                ? contacts.filter(
                    (c) =>
                      c.name.toLowerCase().includes(q) ||
                      (c.accountName ?? '').toLowerCase().includes(q),
                  )
                : contacts;
```

Replace with a single chained version that applies BOTH search and last-touch:

```ts
              const visibleContacts = contacts
                .filter((c) => {
                  if (!q) return true;
                  return (
                    c.name.toLowerCase().includes(q) ||
                    (c.accountName ?? '').toLowerCase().includes(q)
                  );
                })
                .filter((c) => matchesLastTouch(c.lastInteraction, today, contactsLastTouch));
```

Then render the chip row below the modal-actions block in the contacts list (around line 1099):

```tsx
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
                  <LastTouchChips value={contactsLastTouch} onChange={setContactsLastTouch} />
                  <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```

- [ ] **Step 8: Manually verify**

Run the app. Open the accounts list. The chip row appears below the "Add new" / "Prospects only" row. Tap "This wk" → only accounts with last touch within 7 days remain. Tap "3+ mo" → only stale or never-touched accounts. Tap "Never" → only accounts with no last-touch (post-cutoff). Tap "Any" → all accounts. The text search continues to filter independently. Repeat in the contacts list.

- [ ] **Step 9: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/MainScreen.tsx
git commit -m "feat(lists): add last-touch filter chips to accounts/contacts modals" -- apps/mobile/src/features/main/MainScreen.tsx
```

---

## Phase 3 acceptance check

After all tasks pass, verify against the spec's Phase 3 testing list:

- [ ] Tap an account in the list → options dialog appears (not the detail screen).
- [ ] "Open account" routes to account detail correctly.
- [ ] "Add event…" → EventFormModal opens with the account pre-linked.
- [ ] Mark a contact as primary on an account → close → re-open account in the list → primary contact row shows in the dialog.
- [ ] Clear the primary mark → re-open dialog → primary contact row is gone.
- [ ] Delete the contact that was marked primary → re-open dialog → primary contact row is gone (cleanup verified).
- [ ] Move a contact to a different account (change `account_id`) → previous account's primary marker, if it pointed at this contact, is cleared.
- [ ] Tap a contact in the list → options dialog with one row per contact method.
- [ ] "Call cell" → opens dialer; "Text cell" → opens SMS composer; "Email" → opens mail composer.
- [ ] Linked account row → routes to account detail.
- [ ] Last-touch chips → results filter live; combine with text search.

Done.

---

## Self-review notes

**Spec coverage:**
- Item 7 (account options dialog): Tasks 4 (dialog) + 1 (data model for primary contact) + 3 (UI to set primary).
- Item 8 (last-touch filter chips on both lists): Task 6.
- Item 9 (contact options dialog with per-method actions): Task 5.
- Data-model addition (primary_contact_id): Tasks 1, 2, 3.

**Placeholder scan:** No `TBD`, `TODO`, or vague-error-handling phrases. Where Step instructions say "search for X first" or "verify with grep", that's because the existing source is the source of truth — not a placeholder. Each code block is complete code an engineer can paste.

**Type consistency:**
- `Account.primary_contact_id: string | null` declared in Task 1, used in Tasks 2, 3, 4.
- `LastTouchFilter` union declared inline in Task 6 Step 1, used by `matchesLastTouch` (Step 2), accounts/contacts filters (Steps 3, 6), and the `LastTouchChips` component (Step 5). Because the union is repeated rather than aliased into a top-level type, every call site uses the inline literal — keep them in sync if you ever add a new band.
- `RowAction` / `RowActionGroup` from Phase 2 are reused in Tasks 4, 5.
- `EventFormInitial.accountIds` and `contactIds` already exist on the interface — no type changes required.

**Risks called out:**
- Task 1 changes a shared type. Any unmodified `Account` literal will fail typecheck — Task 1 Step 4 explicitly greps for them so nothing is missed.
- Task 2 cleanup runs unconditionally; if the user has many accounts, it iterates all of them. For this scale (a single user's accounts) the iteration cost is negligible.
- Task 6 inline-redefines the filter union four times. If the band names change, all four sites must change in lockstep. Acceptable for now (six bands, low churn); revisit if it ever drifts.
