# BryBo UX Fixes — Design Spec

**Date:** 2026-05-08
**Scope:** 9 UX/data fixes across the BryBo mobile app, organized into 3 phases.
**Implementation order:** Phase 1 → Phase 2 → Phase 3, each shipped before the next begins.

---

## Phase 1 — Quick wins

### Item 1: Auto-note for sales

When a user saves a sale event with an empty `notes` field, populate `notes` with a default of `sale: $<formatted-amount>`.

- **Sale detection:** an event is a sale when `hasAmount` is true (i.e., `amount != null && amountStr.trim() !== ''`). This is the input-time signal in `EventFormModal`. The persisted `Event.type` is reassigned to the literal string `'sale'` on save (existing line 176), but at the point the auto-note rule fires, the in-form signal to use is `hasAmount`.
- **Where:** `src/features/main/EventFormModal.tsx`, in `handleSave()` (around line 178), before the `upsertEvent` call.
- **Rule:** if `hasAmount` and `notes.trim() === ''`, set the persisted `notes = \`sale: ${formatUSD(parsedAmount)}\``.
- **Format:** `$` + `Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount)`.
  - Whole dollars → `$2,500`
  - Cents present → `$2,500.50`
- **Helper:** `formatUSD()` lives in `src/utils/format.ts`. If a similar helper already exists, reuse it.
- **Edit behavior:** if a user clears the notes on edit and saves, the default reapplies. The rule fires anytime notes is empty on save.

### Item 2: Sales default to "done"

When creating a new sale, default `status` to `'done'` regardless of date. Do not force or lock — the user can still toggle the LogRow status checkbox afterward.

- **Where:** `src/features/main/EventFormModal.tsx`, the status auto-resolution at line 77.
- **Current code:** `const status: 'todo' | 'done' = initial.status ?? (date < today ? 'done' : 'todo');`
- **New rule:** `const status: 'todo' | 'done' = initial.status ?? (hasAmount ? 'done' : (date < today ? 'done' : 'todo'));`
  - If `initial.status` was explicitly set (e.g., editing an existing event), preserve it.
  - Else if `hasAmount` (sale), default to `'done'`.
  - Else apply the existing date-based default.
- **No data migration.** Affects newly created or re-saved sales only.
- **No status-toggle changes.** The LogRow checkbox is unchanged for sales.

### Item 5: Linked-account X button right-aligned

In `ContactDetailModal.tsx`, the linked-account `savedRow` (lines ~314–328) does not push the X button to the right edge. Match the layout of the contact-method rows below.

- **Fix:** wrap the name/value `Text` in a `View` with `flex: 1`, or apply `flex: 1` directly to the `Text`. The X button (`removeBtn` Pressable) is then pushed to the right edge.
- **Verify:** by visual inspection the row aligns with the contact-method rows already in the modal.

### Item 6: Hide pre-May-2026 events from display, keep yearly sales totals

Treat any event dated before `2026-05-01` as not-displayed. The user does not want to see the seeded historical events as recent activity. Yearly sales totals on `AccountDetailModal` (which read from those same seeded events) must continue to display.

- **New file:** `src/utils/dateCutoff.ts`
  - Exports `const EVENT_DISPLAY_CUTOFF = '2026-05-01';`
  - Exports `isVisibleEvent(event: { day: { date: string } }): boolean` — returns `event.day.date >= EVENT_DISPLAY_CUTOFF`.
- **Apply at:**
  - `MainScreen.tsx` daily log render
  - `MainScreen.tsx` last/next computations: `lastByAccount`, `lastByContact`, `nextByAccount`, `nextByContact` (lines ~220–298)
  - `AccountDetailModal.tsx` upcoming/past events lists (computed lines ~117–139)
  - `ContactDetailModal.tsx` event lists (if any)
- **Carve-out:** the yearly-sales-totals computation in `AccountDetailModal.tsx` explicitly bypasses `isVisibleEvent`. A one-line inline comment marks the intentional carve-out: `// includes pre-cutoff events: yearly totals span full history`.
- **Seed data unchanged.** This is a display-layer rule.

---

## Phase 2 — Event row menu + Move event

### Item 3: LogRow becomes clearly clickable; follow-up moves into menu

The current LogRow has multiple sub-pressables (status toggle, follow-up arrow) that obscure that the row itself is tappable. Restructure so:

- **Left:** the existing status checkbox stays as its own Pressable. Tapping it still toggles status only.
- **Body:** the row text becomes a Pressable that opens the actions menu. `pressed` opacity confirms tappability.
- **Right:** the follow-up arrow is replaced with a `⋯` (kebab) icon button. The kebab also opens the actions menu. `hitSlop: 8`.

```
┌────────────────────────────────────────┐
│ ☑  Sale: $2,500                    ⋯ │
└────────────────────────────────────────┘
   ↑                ↑                  ↑
   status toggle    body opens menu    kebab opens menu
```

The `log-actions` modal (lines ~827–923) is restructured as:

```
┌─ Sale: $2,500 ─────────────┐
│ Edit                       │
│ Follow-up…                 │
│ Move to…                   │
│ Delete                     │  ← destructive (red)
├─ Linked ───────────────────┤
│ 🏢 Acme Corp               │
│ 👤 Jane Doe                │
└────────────────────────────┘
```

- Order is fixed: Edit, Follow-up…, Move to…, Delete, then linked rows.
- "Follow-up…" calls the existing `startFollowUp(entry)` handler.
- "Move to…" opens the new `MoveEventModal` (item 4).
- Delete styled as destructive (red text).
- Linked accounts/contacts stay tappable to navigate.

### Item 4: Move event

A new flow that lets the user reassign an event to a different day.

- **New file:** `src/features/main/MoveEventModal.tsx`
- **Visual:** mirrors `FollowUpModal.tsx`. Same preset pills (1 week, 2 weeks, 1 month, 3 months) plus a custom-date picker. Header: "Move event". CTA button: "Move".
- **Save handler:**
  ```ts
  const targetDate = resolveDate(presetOrCustom);   // YYYY-MM-DD
  const targetDay = ensureDay(targetDate);          // get-or-create the day
  upsertEvent({ ...event, day_id: targetDay.id });  // status untouched
  ```
- **Status:** preserved (no recomputation from new date).
- **Links:** preserved automatically — accounts/contacts are stored in join tables keyed by event id.
- **Backward moves:** supported via the custom-date picker (no backward presets).
- **After save:** modal closes; if the moved event leaves the currently-viewed day, it disappears from the daily log.
- **Wired into:** the LogRow menu's "Move to…" item (Phase 2 item 3).

---

## Phase 3 — Search/list options dialogs + Last-touch filter

### Shared component: `RowActionsSheet`

A single bottom-anchored modal primitive used for all three menus (event row, account row, contact row). Single source of truth for menu styling.

- **New file:** `src/components/ui/RowActionsSheet.tsx`
- **Props:** `title`, `actions[]` (label + icon + onPress + optional `destructive` flag), `groups[]` (optional grouped sections, each with a label and a list of rows).
- **Rendering:** title row, action list, divider, optional grouped section (e.g., "Linked", contact methods).
- **Used by:** the LogRow menu (Phase 2), the account-actions modal, and the contact-actions modal (Phase 3).

### Item 7: Account options dialog

Tapping an account row in the search/list modal no longer opens the account detail directly — it opens a bottom-sheet dialog of options.

- **Where:** `MainScreen.tsx` accounts list modal (lines 926–1028), row tap handler at line 991.
- **Change:** replace `setModal({ kind: 'account-detail', accountId: a.id })` with `setModal({ kind: 'account-actions', accountId: a.id })`.
- **New modal kind:** `'account-actions'` in the modal state union.
- **Dialog content:**

```
┌─ Acme Corp ──────────────────┐
│ Open account                 │
│ Add event…                   │
├─ Primary contact ────────────┤   ← only if account has a primary contact
│ 👤 Jane Doe                  │
└──────────────────────────────┘
```

- "Open account" → `setModal({ kind: 'account-detail', accountId })`.
- "Add event…" → opens `EventFormModal` with `prefilledAccountIds: [accountId]`, no event id (new event). Mirrors the in-AccountDetail "add event" entry point.
- Primary contact row → `setModal({ kind: 'contact-detail', contactId: primary.id })`.
- **Primary contact resolution — data model change required:**
  - Add `primary_contact_id: string | null` to the `Account` interface in `packages/shared/src/types/entities.ts`.
  - Existing accounts deserialize with `primary_contact_id: null` (the storage adapter must default missing field to `null` — verify in `StorageAdapter` during implementation).
  - Add a small UI in `AccountDetailModal.tsx` to set/clear the primary contact: a "Primary" toggle next to each linked contact in the contacts section. Setting primary on one contact clears it from any other.
  - Setting `primary_contact_id` to a contact id that is no longer linked to the account is prevented by the UI; the store action should also clear the field if the named contact is removed from the account (in `upsertContact` / contact deletion path).
  - **Account-options dialog rule:** show the "Primary contact" section only when `account.primary_contact_id` is non-null and the contact still exists. Otherwise omit the section.
- **No fallback to "first contact"** — if no primary is set, the primary-contact row simply doesn't appear. The user can still navigate via "Open account" → see the contacts list.

### Item 9: Contact options dialog

Tapping a contact row in the search/list modal opens a bottom-sheet dialog instead of going directly to the contact detail.

- **Where:** `MainScreen.tsx` contacts list modal (lines 1093–1140), row tap handler at line 1102.
- **Change:** replace `setModal({ kind: 'contact-detail', contactId: c.id })` with `setModal({ kind: 'contact-actions', contactId: c.id })`.
- **New modal kind:** `'contact-actions'`.
- **Dialog content:**

```
┌─ Jane Doe ───────────────────┐
│ Open contact                 │
│ Add event…                   │
├─ Linked account ─────────────┤   ← only if contact.account_id is set
│ 🏢 Acme Corp                 │
├─ Contact ────────────────────┤
│ ☎ Call cell  555-0101        │
│ 💬 Text cell  555-0101        │
│ ☎ Call work  555-0102        │
│ ✉ Email      jane@acme.com   │
└──────────────────────────────┘
```

- "Open contact" → existing contact-detail modal.
- "Add event…" → opens `EventFormModal` with `prefilledContactIds: [contactId]`, and if `contact.account_id` is set, also `prefilledAccountIds: [accountId]`.
- Linked account row → opens account-detail.
- **Contact methods → action rows:**
  - `cell` → two rows: Call (`tel:`) + Text (`sms:`)
  - `work` → one Call row (`tel:`)
  - `home` → one Call row (`tel:`)
  - `email` → one Email row (`mailto:`)
  - `other` → single non-tappable display row showing the value
- **Order:** cells first (Call+Text per number), then work, then home, then emails, then other. Within a type, primary first.

### Item 8: Last-touch filter chips

A row of selectable chips, single-select, on both the accounts list modal and the contacts list modal. Combines with the existing text search (AND).

- **Layout:** under the search input.
  ```
  [ Search…                                         ]
  [Any] [This wk] [This mo] [3+ mo] [6+ mo] [Never]
  ```
- **State:** `lastTouchFilter: 'any' | 'week' | 'month' | 'stale3' | 'stale6' | 'never'`. Default `'any'`. Resets when the modal closes.
- **Predicates** (operate on `lastByAccount` / `lastByContact`, which already exclude pre-cutoff events from Phase 1):
  - `any`: no filter
  - `week`: last touch within the last 7 days
  - `month`: last touch within the last 30 days
  - `stale3`: last touch ≥ 90 days ago **OR** never touched (post-cutoff)
  - `stale6`: last touch ≥ 180 days ago **OR** never touched
  - `never`: no last touch (post-cutoff)

---

## Architecture notes

- `RowActionsSheet` is the single visual primitive for all three new menus. A future tweak to menu styling is a one-file change.
- `EVENT_DISPLAY_CUTOFF` is a single exported constant. Easy to bump later, easy to grep for.
- `isVisibleEvent` is the predicate for filtering at all read sites. The yearly-sales-totals computation in `AccountDetailModal` intentionally bypasses it; an inline comment marks the carve-out.
- Move-event is a single-field write (`day_id`). No status mutation, no join-table touching — accounts/contacts stay linked by event id.
- All store actions are existing (`upsertEvent` already handles moves since it just upserts). No store changes required.

## File-change summary

| File | Phase | Change |
|---|---|---|
| `src/utils/format.ts` | 1 | Add `formatUSD()` (or reuse) |
| `src/utils/dateCutoff.ts` | 1 | New: `EVENT_DISPLAY_CUTOFF` + `isVisibleEvent()` |
| `src/features/main/EventFormModal.tsx` | 1 | Sale auto-note + sales=done default |
| `src/features/main/ContactDetailModal.tsx` | 1 | X-button right-align fix |
| `packages/shared/src/types/entities.ts` | 3 | Add `primary_contact_id: string \| null` to `Account` |
| `packages/shared/src/storage/StorageAdapter.ts` | 3 | Default missing `primary_contact_id` to `null` on read (if needed) |
| `src/stores/dataStore.ts` | 3 | Clear `account.primary_contact_id` when that contact is removed from the account or deleted |
| `src/features/main/AccountDetailModal.tsx` | 1, 3 | Phase 1: apply cutoff to event lists; preserve yearly-totals carve-out. Phase 3: "Primary" toggle next to each linked contact |
| `src/features/main/MainScreen.tsx` | 1, 2, 3 | Apply cutoff to last/next computations and daily log; new LogRow layout (kebab + body-tap menu); options-dialog routing for account/contact rows; last-touch filter chips; modal state additions |
| `src/components/ui/RowActionsSheet.tsx` | 2 | New shared bottom-sheet menu primitive |
| `src/features/main/MoveEventModal.tsx` | 2 | New modal, mirrors `FollowUpModal` |

## Testing approach

Manual testing per phase via `npm run dev:mobile`:

**Phase 1**
- Create a sale with empty notes → verify auto-note `sale: $<amount>`.
- Create a sale with notes → verify auto-note does NOT overwrite.
- Create a sale (any date) → verify `status === 'done'` by default.
- Toggle a sale's status → verify it still flips to/from `'todo'`.
- Open ContactDetailModal with a linked account → verify X is right-aligned.
- Open accounts list modal → verify pre-2026-05-01 events do not show as "last touch".
- Open an account detail → verify yearly sales totals (2021–2025) still render.

**Phase 2**
- Tap LogRow body → menu opens.
- Tap kebab → menu opens.
- Tap status checkbox → still toggles status only, no menu.
- Pick "Move to…" → 2 weeks → row leaves current day, appears on target day; status preserved; links preserved.
- Pick "Move to…" → custom past date → row moves backward.

**Phase 3**
- Tap an account in the list → options dialog appears (not the detail screen).
- "Open account" → routes to account detail correctly.
- "Add event…" → EventFormModal opens with the account pre-linked.
- Open an account → mark a contact as primary → close → re-open account in the list → primary contact row shows in the dialog.
- Clear the primary mark → re-open dialog → primary contact row is gone.
- Delete the contact that was marked primary → re-open dialog → primary contact row is gone (cleanup verified).
- Tap a contact in the list → options dialog with one row per contact method.
- "Call cell" → opens dialer.
- "Text cell" → opens SMS composer.
- "Email" → opens mail composer.
- Linked account row → routes to account detail.
- Last-touch chips → results filter live; combine with text search.

No automated tests exist in this codebase; not introducing a test framework as part of this work.

## Rollout

1. **Phase 1** ships first on its own branch / PR. Verify in a build before starting Phase 2.
2. **Phase 2** introduces `RowActionsSheet` and `MoveEventModal`. Verify before Phase 3.
3. **Phase 3** reuses `RowActionsSheet` for the new options dialogs and adds the last-touch filter chips.
