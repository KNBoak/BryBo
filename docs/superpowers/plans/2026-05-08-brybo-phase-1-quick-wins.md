# BryBo UX Fixes — Phase 1 Implementation Plan (Quick Wins)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 1 of the BryBo UX fixes spec — sale auto-note, sales=done default, X-button right alignment, May-2026 last-touch cutoff.

**Architecture:** Pure modifications to `EventFormModal`, `ContactDetailModal`, `MainScreen`, and `AccountDetailModal`. Two small new utility files (`format.ts`, `dateCutoff.ts`). No new components, no store changes, no data migration. Display-layer rule for the cutoff; the seed data stays intact.

**Tech Stack:** React Native + Expo, Zustand store, TypeScript. No test framework — verification is manual via `npm run dev:mobile`.

**Spec:** `docs/superpowers/specs/2026-05-08-brybo-ux-fixes-design.md`

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `apps/mobile/src/utils/format.ts` | Create | Currency formatter `formatUSD()` |
| `apps/mobile/src/utils/dateCutoff.ts` | Create | `EVENT_DISPLAY_CUTOFF` constant + `isVisibleEvent()` predicate |
| `apps/mobile/src/features/main/EventFormModal.tsx` | Modify | Sale auto-note (item 1) + sales=done default (item 2) |
| `apps/mobile/src/features/main/ContactDetailModal.tsx` | Modify | X-button right-align (item 5) |
| `apps/mobile/src/features/main/MainScreen.tsx` | Modify | Apply cutoff to daily log + last/next computations (item 6) |
| `apps/mobile/src/features/main/AccountDetailModal.tsx` | Modify | Apply cutoff to event lists; preserve yearly-totals carve-out (item 6) |

---

## Task 1: Add `formatUSD` utility

**Files:**
- Create: `apps/mobile/src/utils/format.ts`

- [ ] **Step 1: Confirm no existing `formatUSD` in the project**

Run:
```bash
grep -rn "formatUSD\|formatCurrency" apps/mobile/src packages/shared/src 2>/dev/null
```
Expected: no matches. If matches found, reuse the existing helper instead of creating a new one (skip to Task 2).

- [ ] **Step 2: Create `format.ts`**

Write the full contents of `apps/mobile/src/utils/format.ts`:

```ts
/**
 * Format a number as US dollars.
 * Whole dollars: $2,500
 * Cents present: $2,500.50
 */
export function formatUSD(amount: number): string {
  return (
    '$' +
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  );
}
```

- [ ] **Step 3: Verify it type-checks**

Run:
```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```
Expected: passes. (If pre-existing errors are unrelated to `format.ts`, that's fine — confirm `format.ts` itself has no errors.)

- [ ] **Step 4: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/utils/format.ts
git commit -m "feat(mobile/utils): add formatUSD helper"
```

---

## Task 2: Sale auto-note in EventFormModal

**Files:**
- Modify: `apps/mobile/src/features/main/EventFormModal.tsx` (around line 178 — the `handleSave` function)

- [ ] **Step 1: Read the current `handleSave` to find the exact lines**

Run:
```bash
sed -n '150,200p' apps/mobile/src/features/main/EventFormModal.tsx
```
Note: `hasAmount` is computed at line 133. The persisted notes value is set in the `upsertEvent` call around line 178 with `notes: notes.trim() || null` (or similar — read the actual line first).

- [ ] **Step 2: Add the import for `formatUSD` at the top of `EventFormModal.tsx`**

Find the existing imports for utilities (e.g., `from '../../utils/...'`) and add:
```ts
import { formatUSD } from '../../utils/format';
```

- [ ] **Step 3: Modify `handleSave` to populate the default note**

Locate the section in `handleSave` where the persisted `notes` value is computed. Before the `upsertEvent` call, add:

```ts
const trimmedNotes = notes.trim();
const finalNotes =
  hasAmount && trimmedNotes === ''
    ? `sale: ${formatUSD(parsedAmount)}`
    : trimmedNotes || null;
```

Replace whatever `notes:` value was being passed to `upsertEvent` with `notes: finalNotes`. (Be careful: existing code may pass `notes.trim() || null` directly. Replace exactly that expression.)

- [ ] **Step 4: Manually verify**

Run:
```bash
cd /Users/kevinboak/dev/BryBo && npm run dev:mobile
```

In the running app:
1. Open the new-event form, enter an amount (e.g., `2500`), select an account, leave notes empty, save.
2. Verify the saved event's notes display as `sale: $2,500`.
3. Open the new-event form again, enter amount `2500.50`, leave notes empty, save.
4. Verify notes display as `sale: $2,500.50`.
5. Open new-event form, enter amount `100`, type `closed deal` in notes, save.
6. Verify notes display as `closed deal` (auto-note does NOT overwrite).
7. Edit a sale, clear the notes, save.
8. Verify notes auto-fill to `sale: $<amount>` again.

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/EventFormModal.tsx
git commit -m "feat(events): default sale note to 'sale: \$<amount>' when notes empty"
```

---

## Task 3: Sales default to "done" status

**Files:**
- Modify: `apps/mobile/src/features/main/EventFormModal.tsx` (line 77)

- [ ] **Step 1: Locate the current status auto-resolution**

Run:
```bash
sed -n '75,80p' apps/mobile/src/features/main/EventFormModal.tsx
```
Expected to see:
```ts
// Status auto-resolves from date: past = done, today/future = todo.
const status: 'todo' | 'done' = initial.status ?? (date < today ? 'done' : 'todo');
```

- [ ] **Step 2: Replace the `status` line**

Replace the single line with:
```ts
// Status auto-resolves: explicit > sale-default > date-based.
const status: 'todo' | 'done' =
  initial.status ?? (hasAmount ? 'done' : (date < today ? 'done' : 'todo'));
```

Note: `hasAmount` is already declared further down (line 133). React doesn't care about declaration order in JSX-bearing components — the `useState` for `amount` is declared earlier (line 54), and the `status` derivation just needs to compute `hasAmount` inline OR be moved below line 133. The simpler fix: replace with the inline condition:

```ts
const status: 'todo' | 'done' =
  initial.status ?? (amount != null && (amount ?? '').trim() !== ''
    ? 'done'
    : (date < today ? 'done' : 'todo'));
```

(Use this second form to avoid forward-reference issues — it duplicates the `hasAmount` check inline.)

- [ ] **Step 3: Verify it type-checks**

Run:
```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```
Expected: passes.

- [ ] **Step 4: Manually verify**

Run the dev server. In the app:
1. Create a new sale event dated today → save → verify the LogRow status checkbox shows it as **done**.
2. Create a new sale event dated next week → save → verify status shows as **done** (not todo).
3. Create a new sale event dated yesterday → save → verify status shows as **done** (consistent).
4. Tap the checkbox on the saved sale → verify it toggles back to **todo** (no forcing).
5. Create a non-sale event (e.g., a call) dated tomorrow → save → verify status defaults to **todo** (date-based default still applies for non-sales).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/EventFormModal.tsx
git commit -m "feat(events): default sale status to 'done' regardless of date"
```

---

## Task 4: Right-align the X button on the linked-account row

**Files:**
- Modify: `apps/mobile/src/features/main/ContactDetailModal.tsx` (lines 314–328)

- [ ] **Step 1: Confirm the current markup**

Run:
```bash
sed -n '312,330p' apps/mobile/src/features/main/ContactDetailModal.tsx
```
Expected to see the linked-account `Pressable` with `Text style={styles.savedType}`, `Text style={styles.savedValue}`, and an inner `Pressable style={styles.removeBtn}`.

- [ ] **Step 2: Wrap `savedValue` in `savedValueWrap` to match the contact-method row pattern**

Locate the lines (around 319–320):
```tsx
<Text style={styles.savedType}>🏢</Text>
<Text style={styles.savedValue} numberOfLines={1}>{linkedAccount.name}</Text>
```

Replace with:
```tsx
<Text style={styles.savedType}>🏢</Text>
<View style={styles.savedValueWrap}>
  <Text style={styles.savedValue} numberOfLines={1}>{linkedAccount.name}</Text>
</View>
```

The `savedValueWrap` style (already defined at line 652: `{ flex: 1, minWidth: 0 }`) takes the row's free space and pushes the X button to the right edge.

- [ ] **Step 3: Verify imports**

Confirm `View` is already imported from `react-native` at the top of the file. (It almost certainly is — this is a React Native screen.)

- [ ] **Step 4: Manually verify**

In the running app:
1. Open a contact that has a linked account.
2. Verify the X button on the "Linked account" row sits flush against the right edge of the row, matching the X buttons on the contact-method rows below.
3. Verify tapping the X still removes the linked account (no behavior change).

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/ContactDetailModal.tsx
git commit -m "fix(contact-modal): right-align X button on linked-account row"
```

---

## Task 5: Create `dateCutoff.ts` with `EVENT_DISPLAY_CUTOFF` and `isVisibleEvent`

**Files:**
- Create: `apps/mobile/src/utils/dateCutoff.ts`

- [ ] **Step 1: Decide the predicate signature**

The store typically holds events as flat objects with a `day_id`. The helper must accept whatever shape the calling site has. To keep callers simple:
- Helper A: `isVisibleEventDate(date: string): boolean` — operates on a YYYY-MM-DD string.
- Helper B: `isVisibleEvent(event, dayById)` — needs a lookup. Skip; awkward.

Use Helper A.

- [ ] **Step 2: Create the file**

Write the full contents of `apps/mobile/src/utils/dateCutoff.ts`:

```ts
/**
 * Cutoff for displaying events.
 *
 * Events dated before this YYYY-MM-DD are treated as historical seed data
 * and are filtered out of:
 *   - the daily log
 *   - last-touch / next-event computations on the account & contact lists
 *   - the upcoming/past event lists on AccountDetailModal & ContactDetailModal
 *
 * Yearly sales totals on AccountDetailModal intentionally bypass this filter
 * (they aggregate across the full event history).
 */
export const EVENT_DISPLAY_CUTOFF = '2026-05-01';

/**
 * Returns true when an event's day-date is at or after the display cutoff.
 * Pass the event's day's `date` field (YYYY-MM-DD).
 */
export function isVisibleEventDate(date: string): boolean {
  return date >= EVENT_DISPLAY_CUTOFF;
}
```

- [ ] **Step 3: Verify it type-checks**

Run:
```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```
Expected: passes.

- [ ] **Step 4: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/utils/dateCutoff.ts
git commit -m "feat(mobile/utils): add EVENT_DISPLAY_CUTOFF and isVisibleEventDate"
```

---

## Task 6: Apply cutoff in `MainScreen` (daily log + last/next computations)

**Files:**
- Modify: `apps/mobile/src/features/main/MainScreen.tsx`

- [ ] **Step 1: Add the import**

At the top of `MainScreen.tsx`, find the imports for `../../utils/...` and add:

```ts
import { isVisibleEventDate } from '../../utils/dateCutoff';
```

- [ ] **Step 2: Locate the last/next computations**

Run:
```bash
grep -nE "lastByAccount|lastByContact|nextByAccount|nextByContact" apps/mobile/src/features/main/MainScreen.tsx
```
Expected: definitions around lines 220–298.

Read lines 220–300 to understand the existing structure:
```bash
sed -n '215,300p' apps/mobile/src/features/main/MainScreen.tsx
```

These are typically computed by iterating events, joining to `dayById[event.day_id]` to get the date string, and reducing to min/max per entity id.

- [ ] **Step 3: Filter events at the source of these computations**

Inside each of `lastByAccount`, `lastByContact`, `nextByAccount`, `nextByContact`, when iterating events, skip any event whose joined day-date fails `isVisibleEventDate`. Concretely, where the existing code does something like:

```ts
const day = dayById[event.day_id];
if (!day) continue;
if (day.date >= today) continue; // for last*
```

add the cutoff check as the first guard:

```ts
const day = dayById[event.day_id];
if (!day) continue;
if (!isVisibleEventDate(day.date)) continue;   // NEW
if (day.date >= today) continue;
```

Apply the same `isVisibleEventDate` guard in the `nextBy*` computations as the first guard.

(Read the actual code first — the structure may differ slightly; preserve the existing logic and only add the cutoff guard.)

- [ ] **Step 4: Locate the daily log render**

Run:
```bash
grep -nE "logEntries|dayEntries|todaysEvents|filteredEvents" apps/mobile/src/features/main/MainScreen.tsx | head -20
```

Identify where the events shown in the daily log are filtered. The day shown is typically the current day; events for that day are pulled. Since the user navigates by day, only events on the visible day are shown — events before May 2026 only appear if the user navigates back to a pre-May-2026 day. Decision: still apply the filter at the rendering layer so that if the user lands on a pre-cutoff day (e.g., via a link from a stale modal), no events render.

In the daily log render (the `LogRow` map around line 740–760), wrap the source array with a filter:

```ts
const visibleEntries = entries.filter((e) =>
  isVisibleEventDate(dayById[e.day_id]?.date ?? '0000-00-00'),
);
```

Use `visibleEntries` in place of `entries` for the `.map(...)` that renders rows. (The variable name `entries` may differ — match what's actually there.)

- [ ] **Step 5: Verify it type-checks**

Run:
```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```
Expected: passes.

- [ ] **Step 6: Manually verify**

Run the dev server. Open the Al-Mar seeded profile (which has events back to 2021):

1. Open the accounts list modal → for each account, the "last touch" should show **only** post-May-2026 activity. For accounts whose only events are pre-May-2026, the "last touch" should show as never / blank (not show 2025 events).
2. Open the contacts list modal → same check on contacts.
3. Navigate the daily-log day-cycler back to (e.g.) Dec 31, 2024 → no events should render in the daily log (the seeded yearly-summary events are filtered out).
4. Navigate to a day in May 2026 or later → events render normally.

- [ ] **Step 7: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/MainScreen.tsx
git commit -m "feat(events): hide pre-2026-05-01 events from daily log and last-touch"
```

---

## Task 7: Apply cutoff in `AccountDetailModal` event lists, preserve yearly-totals

**Files:**
- Modify: `apps/mobile/src/features/main/AccountDetailModal.tsx`

- [ ] **Step 1: Add the import**

At the top of `AccountDetailModal.tsx`:

```ts
import { isVisibleEventDate } from '../../utils/dateCutoff';
```

- [ ] **Step 2: Identify the event-list and yearly-totals computations**

Run:
```bash
grep -nE "upcomingEvents|pastEvents|yearlySales|yearTotals|byYear" apps/mobile/src/features/main/AccountDetailModal.tsx
```
Expected: event-list computation around lines 117–139, yearly-totals computation somewhere nearby.

Read lines 110–200 of the file:
```bash
sed -n '110,200p' apps/mobile/src/features/main/AccountDetailModal.tsx
```

- [ ] **Step 3: Filter the visible event lists**

In whichever variables produce the upcoming and past event lists rendered in the modal, add a `.filter` call gated on `isVisibleEventDate`:

```ts
const visiblePast = pastEvents.filter((e) =>
  isVisibleEventDate(dayById[e.day_id]?.date ?? '0000-00-00'),
);
const visibleUpcoming = upcomingEvents.filter((e) =>
  isVisibleEventDate(dayById[e.day_id]?.date ?? '0000-00-00'),
);
```

Replace usages of `pastEvents` / `upcomingEvents` in the JSX with `visiblePast` / `visibleUpcoming`. (Variable names may differ — match what's there.)

- [ ] **Step 4: Verify yearly-totals computation does NOT use the filter**

Locate the yearly-sales-totals computation (often a `byYear` reduce over events). It should iterate over the **unfiltered** events array. Add a one-line comment marking the carve-out:

```ts
// Includes pre-cutoff events: yearly totals span full sales history.
const yearTotals = events.reduce(/* ... existing code ... */);
```

(Use whatever variable name is actually present — `salesByYear`, `yearTotals`, etc.)

- [ ] **Step 5: Verify it type-checks**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```

- [ ] **Step 6: Manually verify**

Run the dev server. Open an account that has both seeded yearly sales (2021–2025) and at least one post-May-2026 event:

1. Verify the "Past events" list on the account modal shows only post-2026-05-01 events.
2. Verify the yearly sales totals (e.g., `2021 — $X`, `2022 — $Y`) STILL display at full historical breadth.
3. Verify "Upcoming events" likewise excludes any pre-cutoff events (rare in normal use, but the seed data may have an upcoming-style entry).

- [ ] **Step 7: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/AccountDetailModal.tsx
git commit -m "feat(account-modal): hide pre-2026-05-01 events; preserve yearly totals"
```

---

## Phase 1 acceptance check

After all tasks pass, run a final pass through the spec's testing list (spec section "Testing approach → Phase 1"):

- [ ] Sale with empty notes → auto-note `sale: $<amount>`.
- [ ] Sale with typed notes → auto-note does NOT overwrite.
- [ ] Sale (any date) → status defaults to `done`.
- [ ] Sale checkbox toggles to `todo` (not forced).
- [ ] ContactDetailModal linked-account X is right-aligned.
- [ ] Accounts/contacts list modals: pre-2026-05-01 events excluded from "last touch".
- [ ] Account modal: yearly sales totals (2021–2025) still render.

Done.

---

## Self-review notes

**Spec coverage:** Phase 1 items 1, 2, 5, 6 each map to a task (Task 2, Task 3, Task 4, Tasks 5–7 respectively). Task 1 (formatUSD helper) is a precondition for Task 2.

**Placeholder scan:** No `TBD`, `TODO`, or vague-error-handling phrases. Each task contains exact code or exact code-shape patterns to replace. Where a verification step says "match what's actually there" (e.g., variable names like `entries` or `pastEvents`), that's because the existing source is the source of truth — not a placeholder.

**Type consistency:** `formatUSD(n: number): string` declared in Task 1, used in Task 2. `isVisibleEventDate(date: string): boolean` declared in Task 5, used in Tasks 6 and 7. `EVENT_DISPLAY_CUTOFF` declared in Task 5, used as a constant in the predicate.
