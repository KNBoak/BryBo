# BryBo UX Fixes — Phase 2 Implementation Plan (Event-row menu + Move)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Phase 2 of the BryBo UX-fixes spec — event-row pop-up menu (Edit/Follow-up/Move/Delete + linked rows), a clearly-clickable LogRow with a kebab affordance, and a "Move to…" flow that reassigns an event to a different day.

**Architecture:** A new shared `RowActionsSheet` component captures the menu visual primitive used by the LogRow menu in this phase (and by the account/contact options dialogs in Phase 3). The existing in-line log-actions modal in `MainScreen.tsx` is refactored to use it. A new `MoveEventModal` (mirroring `FollowUpModal`) does an in-place `day_id` update via the existing `upsertEvent` action — no store changes required.

**Tech Stack:** React Native + Expo, Zustand store, TypeScript. No test framework — verification is manual via `npm run dev:mobile`.

**Spec:** `docs/superpowers/specs/2026-05-08-brybo-ux-fixes-design.md` (Phase 2 — Event row menu + Move event)

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `apps/mobile/src/components/ui/RowActionsSheet.tsx` | Create | Generic bottom-sheet menu primitive (title, action rows, optional grouped sections). Reused in Phase 3. |
| `apps/mobile/src/features/main/MainScreen.tsx` | Modify | Refactor log-actions modal to use `RowActionsSheet`; restructure `LogRow` layout (kebab + body-tap menu); add `Follow-up` and `Move to…` actions; remove inline follow-up arrow. |
| `apps/mobile/src/features/main/MoveEventModal.tsx` | Create | New modal mirroring `FollowUpModal`: preset pills + custom-date picker + "Move" CTA; updates `day_id` of the source event in place. |

---

## Task 1: Create `RowActionsSheet` shared component

A generic bottom-anchored menu primitive. Self-contained styling that matches the existing log-actions modal visual.

**Files:**
- Create: `apps/mobile/src/components/ui/RowActionsSheet.tsx`

- [ ] **Step 1: Read the existing modal styles for reference**

The log-actions modal in `MainScreen.tsx` uses these style keys (do not copy them — read them so the new component can match the look):

```bash
grep -nE "modalOverlay|modalSheet|modalTitle|modalBody|modalRow|modalRowIcon|modalRowText|modalSection|modalCancel|modalCancelText" /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/MainScreen.tsx | head -30
```

You'll see definitions clustered around lines that style the bottom-sheet pattern (overlay → centered/bottom sheet → title → action rows with icon + label → optional section divider → Cancel button). The new component will define equivalent styles internally so it can be moved into a shared component without coupling to MainScreen's StyleSheet.

- [ ] **Step 2: Create the file**

Write the full contents of `apps/mobile/src/components/ui/RowActionsSheet.tsx`:

```tsx
import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

export interface RowAction {
  /** Stable React key. Use a verb for action items (e.g., 'edit') or an entity id for grouped rows. */
  key: string;
  /** Emoji or single-char glyph rendered in the leading icon circle. */
  icon: string;
  label: string;
  onPress: () => void;
  /** Render the label in danger color. Optional. */
  destructive?: boolean;
  /** Override the icon background. Optional — defaults to a subtle raised tint. */
  iconBackground?: string;
  /** Override the icon glyph color. Optional. */
  iconColor?: string;
}

export interface RowActionGroup {
  /** Section heading shown above the rows. */
  label: string;
  items: RowAction[];
}

export interface RowActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Title rendered at the top of the sheet (typically the entity name). */
  title: string;
  /** Top-level action rows (Edit, Follow-up, Move, Delete, …). */
  actions: RowAction[];
  /** Optional grouped sections rendered below the actions (e.g., "Linked", "Contact"). */
  groups?: RowActionGroup[];
}

/**
 * A reusable bottom-sheet menu used by:
 * - LogRow action menu (Phase 2)
 * - Account/contact options dialogs (Phase 3)
 *
 * Renders: overlay → sheet → title → action rows → optional groups → Cancel.
 * Tapping the overlay or "Cancel" calls onClose. The actions themselves are
 * responsible for closing the sheet via their own onPress.
 */
export function RowActionsSheet({ visible, onClose, title, actions, groups }: RowActionsSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>

          <View style={styles.body}>
            {actions.map((a) => (
              <Row key={a.key} action={a} />
            ))}

            {groups?.map((g) => (
              <React.Fragment key={g.label}>
                <Text style={styles.section}>{g.label}</Text>
                {g.items.map((item) => (
                  <Row key={item.key} action={item} />
                ))}
              </React.Fragment>
            ))}
          </View>

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ action }: { action: RowAction }) {
  const iconBg = action.iconBackground ?? colors.bg.raised;
  return (
    <Pressable style={styles.row} onPress={action.onPress}>
      <View style={[styles.rowIcon, { backgroundColor: iconBg }]}>
        <Text style={action.iconColor ? { color: action.iconColor } : undefined}>{action.icon}</Text>
      </View>
      <Text
        style={[
          styles.rowText,
          action.destructive && { color: colors.text.danger },
        ]}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    gap: spacing[2],
  },
  title: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    paddingHorizontal: spacing[1],
  },
  body: {
    gap: spacing[1],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2.5],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    fontSize: typography.size.base,
    color: colors.text.primary,
  },
  section: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing[1],
    marginTop: spacing[1],
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: spacing[3],
    marginTop: spacing[1],
  },
  cancelText: {
    fontSize: typography.size.base,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
});
```

- [ ] **Step 3: Re-export from the UI barrel (if one exists)**

Run:
```bash
cat /Users/kevinboak/dev/BryBo/apps/mobile/src/components/ui/index.ts
```

If the file exists with named re-exports, add:
```ts
export { RowActionsSheet } from './RowActionsSheet';
export type { RowAction, RowActionGroup, RowActionsSheetProps } from './RowActionsSheet';
```

If `index.ts` doesn't exist, skip this step.

- [ ] **Step 4: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```
Expected: passes. Pre-existing errors elsewhere are OK.

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/components/ui/RowActionsSheet.tsx apps/mobile/src/components/ui/index.ts
git commit -m "feat(ui): add RowActionsSheet shared bottom-sheet menu primitive" -- apps/mobile/src/components/ui/RowActionsSheet.tsx apps/mobile/src/components/ui/index.ts
```

(If `index.ts` was unchanged or didn't exist, drop it from the `git add` and the pathspec.)

---

## Task 2: Switch the log-actions modal to use `RowActionsSheet` (preserve current actions)

A pure visual primitive swap with NO behavior change. Existing actions: Edit, Delete, plus linked-account / linked-contact rows. Same handlers wired through.

**Files:**
- Modify: `apps/mobile/src/features/main/MainScreen.tsx`

- [ ] **Step 1: Locate the log-actions block**

Run:
```bash
sed -n '829,927p' /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/MainScreen.tsx
```

You'll see the inline `<Modal visible={modal.kind === 'log-actions'} …>` block. Inside it, there's an IIFE that builds `entry`, `linkedAccts`, `linkedConts`, `confirmDelete`, then renders the title + action rows + linked sections + Cancel.

- [ ] **Step 2: Add the import**

At the top of `MainScreen.tsx`, find the imports for `../../components/ui/...` (Button, Pill, Tag) and add:

```ts
import { RowActionsSheet, type RowAction, type RowActionGroup } from '../../components/ui';
```

(If the barrel didn't exist and Task 1 created the component without re-exporting, import directly: `from '../../components/ui/RowActionsSheet'`.)

- [ ] **Step 3: Replace the entire log-actions `<Modal>…</Modal>` block**

Replace the full block (lines ~829–926, the `{/* Log row action sheet */}` comment plus the `<Modal …>` element) with:

```tsx
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

        const actions: RowAction[] = [
          {
            key: 'edit',
            icon: '✏️',
            label: 'Edit',
            onPress: () => { closeModal(); startEditEntry(entry); },
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
```

The handler bodies are identical to before — same `startEditEntry`, same `confirmDelete`, same nav. Only the rendering primitive changed.

- [ ] **Step 4: If `colors` isn't already imported in `MainScreen.tsx`, leave it — the existing modal code already uses `colors.status.todayBg`/`customerBg`. Just confirm.**

Run:
```bash
grep -nE "^import .* colors" /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/MainScreen.tsx | head
```
Expected: existing import present.

- [ ] **Step 5: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```
Expected: passes.

- [ ] **Step 6: Manually verify**

Run `npm run dev:mobile`. Tap an existing log row → menu opens → tap Edit → goes to edit. Tap Delete → confirm dialog → delete works. Linked accounts/contacts navigate to their detail modals. Visual look should match what was there before (same rounded sheet, same icon circles, same Cancel).

- [ ] **Step 7: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/MainScreen.tsx
git commit -m "refactor(log-actions): render via RowActionsSheet primitive" -- apps/mobile/src/features/main/MainScreen.tsx
```

---

## Task 3: Add `Follow-up…` to the menu (between Edit and Delete)

The `LogRow` currently has an inline follow-up arrow that wires into `startFollowUp(entry)`. Bring that handler into the menu now so we can remove the inline arrow in Task 4 without losing the feature.

**Files:**
- Modify: `apps/mobile/src/features/main/MainScreen.tsx`

- [ ] **Step 1: Locate the existing `startFollowUp` handler**

```bash
grep -nE "startFollowUp" /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/MainScreen.tsx
```
Confirm the handler exists and accepts an entry/source.

- [ ] **Step 2: Insert the `Follow-up…` action between Edit and Delete**

In the `actions` array constructed in the log-actions block (from Task 2), insert a new item between `'edit'` and `'delete'`:

```ts
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
            key: 'delete',
            icon: '🗑️',
            label: 'Delete',
            destructive: true,
            onPress: confirmDelete,
          },
        ];
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```

- [ ] **Step 4: Manually verify**

Run the app. Open a log row's menu → see Edit / Follow-up… / Delete in that order. Tap Follow-up… → the FollowUpModal opens with the source pre-filled. Confirm it works the same as the previous arrow button did.

- [ ] **Step 5: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/MainScreen.tsx
git commit -m "feat(log-actions): add Follow-up… to the row menu" -- apps/mobile/src/features/main/MainScreen.tsx
```

---

## Task 4: Restructure `LogRow` layout (kebab + body-tap, remove inline follow-up arrow)

The row currently has: status checkbox (left), body (text), inline follow-up arrow (right). Now we want: status checkbox (left, unchanged), body that opens the menu when tapped, kebab on the right that also opens the menu, no inline arrow.

**Files:**
- Modify: `apps/mobile/src/features/main/MainScreen.tsx`

- [ ] **Step 1: Locate `LogRow`**

```bash
grep -n "function LogRow" /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/MainScreen.tsx
```
Around line 1320.

- [ ] **Step 2: Remove `onFollowUp` from `LogRow` props and call sites**

In `LogRow`'s props interface (around line 1320–1328), remove the `onFollowUp: () => void;` prop.

In the call site that renders `<LogRow … onFollowUp={…} />` (around line 749 — find with `grep -n "<LogRow" apps/mobile/src/features/main/MainScreen.tsx`), remove the `onFollowUp` prop. The handler `startFollowUp` is still used inside the menu via Task 3 — do not delete the function itself.

- [ ] **Step 3: Replace the inline follow-up arrow with a kebab**

In `LogRow`, replace the entire trailing follow-up `Pressable` block (lines ~1380–1388):

```tsx
      <Pressable
        style={styles.followUpBtn}
        onPress={(e) => { e.stopPropagation(); props.onFollowUp(); }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Add follow-up"
      >
        <Text style={styles.followUpBtnText}>➤</Text>
      </Pressable>
```

with:

```tsx
      <Pressable
        style={styles.kebabBtn}
        onPress={(e) => { e.stopPropagation(); props.onPress(); }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Open row menu"
      >
        <Text style={styles.kebabBtnText}>⋯</Text>
      </Pressable>
```

The body `Pressable` (the outer one wrapping the row) already calls `props.onPress` when tapped — that's what opens the action sheet. So tapping anywhere on the row body opens the menu, and the kebab does the same with explicit affordance.

- [ ] **Step 4: Add `kebabBtn` and `kebabBtnText` styles**

In the `StyleSheet.create({...})` block at the bottom of `MainScreen.tsx`, find the existing `followUpBtn` and `followUpBtnText` definitions (around lines 1913–1928). Replace BOTH of them with:

```ts
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
```

(Style is intentionally lighter than the previous follow-up arrow — no border, no surface fill — because the kebab is a secondary affordance now that the whole row is tappable.)

- [ ] **Step 5: Verify nothing else references `followUpBtn` or `followUpBtnText`**

```bash
grep -nE "followUpBtn|followUpBtnText" /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/MainScreen.tsx
```
Expected: no matches. If any remain, delete or rename them — they're stale.

- [ ] **Step 6: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```

- [ ] **Step 7: Manually verify**

Run the app. View a day with log rows.
- Status checkbox tap → still toggles status only (no menu).
- Body tap → menu opens.
- Kebab tap → menu opens.
- No inline follow-up arrow remaining.
- Follow-up still reachable via the menu (from Task 3).

- [ ] **Step 8: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/MainScreen.tsx
git commit -m "feat(log-row): kebab menu affordance; body tap opens menu" -- apps/mobile/src/features/main/MainScreen.tsx
```

---

## Task 5: Create `MoveEventModal` and wire it to a new `Move to…` menu action

A new modal mirroring `FollowUpModal`'s shape — preset pills + custom-date picker + a "Move" CTA. On save, finds-or-creates the target day and calls `upsertEvent({ ...event, day_id: newDayId }, accountIds, contactIds)` to reassign the event in place. Status is preserved (no recomputation). Linked accounts/contacts are preserved automatically.

**Files:**
- Create: `apps/mobile/src/features/main/MoveEventModal.tsx`
- Modify: `apps/mobile/src/features/main/MainScreen.tsx`

- [ ] **Step 1: Confirm the source-event read path**

The log-actions menu has access to `entry` (a `LogEntry` projection). To move, we need the underlying full `Event` object so we can pass the unchanged status, notes, amount, etc. through `upsertEvent`. The store exposes `events`. Run:

```bash
grep -nE "useDataStore.*events|s.events" /Users/kevinboak/dev/BryBo/apps/mobile/src/features/main/MainScreen.tsx | head -5
```

Confirm the events array is already read by `MainScreen` (it is — `storeEvents` is used in many memos). The MoveEventModal will look the event up the same way.

- [ ] **Step 2: Create the `MoveEventModal` component (defines and exports `MoveEventSource`)**

Write `apps/mobile/src/features/main/MoveEventModal.tsx` with these contents:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Alert } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { useDataStore } from '../../stores/dataStore';
import { generateId } from '../../utils/ids';
import { logError } from '../../utils/debug';
import { Button } from '../../components/ui';
import { CalendarModal } from './CalendarModal';
import {
  buildWorkingDayLookup,
  addWorkingDayOffset,
  type OffsetResult,
} from '@brybo/shared';
import type { Day as StoreDay } from '@brybo/shared';

const TAG = 'MoveEventModal';

export interface MoveEventSource {
  eventId: string;
  /** Original day's date (YYYY-MM-DD) — used as the preset offset anchor. */
  sourceDate: string;
}

interface Props {
  visible: boolean;
  source: MoveEventSource | null;
  onClose: () => void;
  /** Called when user taps "View" in the post-save confirmation. */
  onNavigateToDate?: (date: string) => void;
}

type Preset = { label: string; unit: 'week' | 'month'; count: number };
const PRESETS: Preset[] = [
  { label: '1 week',   unit: 'week',  count: 1 },
  { label: '2 weeks',  unit: 'week',  count: 2 },
  { label: '1 month',  unit: 'month', count: 1 },
  { label: '3 months', unit: 'month', count: 3 },
];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function MoveEventModal({ visible, source, onClose, onNavigateToDate }: Props) {
  const activeUserId = useDataStore((s) => s.activeUserId);
  const storeDays = useDataStore((s) => s.days);
  const storeEvents = useDataStore((s) => s.events);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const eventContacts = useDataStore((s) => s.eventContacts);
  const upsertEvent = useDataStore((s) => s.upsertEvent);
  const upsertDay = useDataStore((s) => s.upsertDay);

  const [presetIdx, setPresetIdx] = useState<number | null>(0);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !source) return;
    setPresetIdx(0);
    setCustomDate(null);
    setShowCalendar(false);
  }, [visible, source]);

  const userDays = useMemo(
    () => storeDays.filter((d) => d.user_id === activeUserId),
    [storeDays, activeUserId],
  );
  const isWorking = useMemo(() => buildWorkingDayLookup(userDays), [userDays]);

  // Resolved date for the currently selected option.
  const resolved: { date: string; offset?: OffsetResult; isCustom: boolean } | null = useMemo(() => {
    if (!source) return null;
    if (customDate != null) return { date: customDate, isCustom: true };
    if (presetIdx == null) return null;
    const p = PRESETS[presetIdx];
    const offset = addWorkingDayOffset(source.sourceDate, p.unit, p.count, isWorking);
    return { date: offset.resolved, offset, isCustom: false };
  }, [source, customDate, presetIdx, isWorking]);

  const sourceEvent = useMemo(
    () => (source ? storeEvents.find((e) => e.id === source.eventId) ?? null : null),
    [storeEvents, source],
  );

  const canSave = !!activeUserId && !!source && !!resolved && !!sourceEvent;

  const handleSave = async () => {
    if (!canSave || !activeUserId || !source || !resolved || !sourceEvent) return;
    if (resolved.date === source.sourceDate) {
      // No-op move — just close.
      onClose();
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      let day = storeDays.find((d) => d.user_id === activeUserId && d.date === resolved.date);
      if (!day) {
        day = {
          id: generateId(),
          user_id: activeUserId,
          date: resolved.date,
          notes: null,
          created_at: now,
          updated_at: now,
        } as StoreDay;
        await upsertDay(day);
      }

      const accountIds = eventAccounts
        .filter((ea) => ea.event_id === sourceEvent.id)
        .map((ea) => ea.account_id);
      const contactIds = eventContacts
        .filter((ec) => ec.event_id === sourceEvent.id)
        .map((ec) => ec.contact_id);

      // Update day_id in place; status, notes, amount, type, is_cancelled all preserved.
      await upsertEvent(
        { ...sourceEvent, day_id: day.id, updated_at: now },
        accountIds,
        contactIds,
      );

      const resolvedDate = resolved.date;
      onClose();
      Alert.alert(
        'Event moved',
        `Now on ${formatLong(resolvedDate)}.`,
        onNavigateToDate
          ? [
              { text: 'OK', style: 'cancel' },
              { text: 'View', onPress: () => onNavigateToDate(resolvedDate) },
            ]
          : [{ text: 'OK' }],
      );
    } catch (e) {
      logError(TAG, 'handleSave threw', e);
    } finally {
      setSaving(false);
    }
  };

  if (!source) {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose} />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Move event</Text>
          <Text style={styles.subtitle}>Currently on {formatLong(source.sourceDate)}.</Text>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Move to</Text>
            <View style={styles.presets}>
              {PRESETS.map((p, i) => {
                const active = customDate == null && presetIdx === i;
                return (
                  <Pressable
                    key={p.label}
                    style={[styles.preset, active && styles.presetActive]}
                    onPress={() => { setPresetIdx(i); setCustomDate(null); }}
                  >
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>{p.label}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.preset, customDate != null && styles.presetActive]}
                onPress={() => setShowCalendar(true)}
              >
                <Text style={[styles.presetText, customDate != null && styles.presetTextActive]}>
                  {customDate ? formatDate(customDate) : 'Pick a date…'}
                </Text>
              </Pressable>
            </View>

            {resolved ? (
              <Text style={styles.resolvedText}>Will move to {formatLong(resolved.date)}.</Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Button title={saving ? 'Moving…' : 'Move'} onPress={handleSave} disabled={!canSave || saving} />
            </View>
          </View>
        </View>
      </View>

      <CalendarModal
        visible={showCalendar}
        viewDate={customDate ?? source.sourceDate}
        onPick={(iso) => { setCustomDate(iso); setPresetIdx(null); setShowCalendar(false); }}
        onClose={() => setShowCalendar(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg.canvas,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[4],
    maxHeight: '85%',
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    marginTop: spacing[1],
  },
  body: {
    paddingTop: spacing[3],
    gap: spacing[3],
  },
  sectionLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  preset: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.surface,
  },
  presetActive: {
    borderColor: colors.interactive.primary,
    backgroundColor: colors.interactive.primary,
  },
  presetText: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  presetTextActive: {
    color: '#fff',
    fontWeight: typography.weight.semibold,
  },
  resolvedText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[2],
    alignItems: 'center',
    paddingTop: spacing[3],
  },
  cancelBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  cancelBtnText: {
    fontSize: typography.size.base,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
});
```

Note: this is a deliberately lighter version of `FollowUpModal` — no notes, no type pills, no account/contact picker, because moving an event doesn't change those things.

- [ ] **Step 3: Wire `MoveEventModal` into `MainScreen.tsx`** (import + modal kind + render + handler + menu action — all together so the type and its references stay in sync)

3a. **Import** at the top of `MainScreen.tsx` (sibling to the existing `FollowUpModal` import — that line is currently `import { FollowUpModal, type FollowUpSource } from './FollowUpModal';`):

```ts
import { MoveEventModal, type MoveEventSource } from './MoveEventModal';
```

3b. **Add `'move-event'` to the modal-state union** (around line 342). The new line goes immediately after the existing `'follow-up'` line:

```ts
    | { kind: 'follow-up'; source: FollowUpSource }
    | { kind: 'move-event'; source: MoveEventSource }
```

3c. **Render the modal.** Find where `<FollowUpModal …>` is rendered (near the bottom of the JSX tree, alongside the other modals). Add a sibling render directly after it:

```tsx
      <MoveEventModal
        visible={modal.kind === 'move-event'}
        source={modal.kind === 'move-event' ? modal.source : null}
        onClose={closeModal}
        onNavigateToDate={(iso) => { setViewDate(iso); closeModal(); }}
      />
```

3d. **Add the `startMoveEvent` handler** near the existing `startFollowUp` handler. Find it with `grep -n "startFollowUp" apps/mobile/src/features/main/MainScreen.tsx`. Beside it, add:

```ts
  const startMoveEvent = (entry: LogEntry) => {
    setModal({ kind: 'move-event', source: { eventId: entry.id, sourceDate: viewDate } });
  };
```

(`viewDate` is the date currently displayed in the daily log — that's the source event's day, since the row only renders for the visible day.)

3e. **Add the `Move to…` action to the log-actions menu.** In the same `actions: RowAction[]` array (Task 3 left it at Edit / Follow-up… / Delete), insert a new entry between Follow-up and Delete:

```ts
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
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/kevinboak/dev/BryBo && npm run typecheck
```

- [ ] **Step 5: Manually verify**

Run the app.
- Open a log row's menu → see Edit / Follow-up… / Move to… / Delete.
- Tap Move to… → MoveEventModal opens with the source's day shown and the 1-week preset selected.
- Tap "2 weeks" → the resolved date updates.
- Tap Move → confirmation alert → "View" → navigate to the new day → the row appears there.
- Open the OLD day → row no longer there (it moved, not duplicated).
- Re-open the row's menu after the move → linked accounts/contacts still present, status preserved.
- Tap "Pick a date…" → calendar → pick a backward date → Move → row moves backward.
- Move with the same date as source → modal just closes (no-op handled).

- [ ] **Step 6: Commit**

```bash
cd /Users/kevinboak/dev/BryBo
git add apps/mobile/src/features/main/MoveEventModal.tsx apps/mobile/src/features/main/MainScreen.tsx
git commit -m "feat(events): add Move-to flow that reassigns event day in place" -- apps/mobile/src/features/main/MoveEventModal.tsx apps/mobile/src/features/main/MainScreen.tsx
```

---

## Phase 2 acceptance check

After all tasks pass, verify against the spec's Phase 2 testing list:

- [ ] Tap LogRow body → menu opens.
- [ ] Tap kebab → menu opens.
- [ ] Tap status checkbox → toggles status only, no menu.
- [ ] Menu order: Edit / Follow-up… / Move to… / Delete, with linked accounts/contacts as grouped sections below.
- [ ] Pick "Move to…" → 2 weeks → row leaves current day, appears on target day. Status preserved. Links preserved.
- [ ] Pick "Move to…" → custom past date → row moves backward. Status still preserved.

Done.

---

## Self-review notes

**Spec coverage:**
- Item 3 (LogRow clearly clickable, follow-up moves into menu): Tasks 2, 3, 4.
- Item 4 (Move event with date presets, in-place day_id update): Task 5.
- Shared `RowActionsSheet` primitive for Phase 2 menu and Phase 3 dialogs: Task 1.

**Placeholder scan:** No `TBD`, `TODO`, or vague-error-handling phrases. Each task contains exact code or exact code-shape replacements. The instruction "match what's actually there" appears once around `colors.status.*` references — these are the existing canonical names; not a placeholder.

**Type consistency:**
- `RowAction` (key/icon/label/onPress/destructive/iconBackground/iconColor) declared in Task 1, used in Tasks 2, 3, 5.
- `RowActionGroup` declared in Task 1, used in Tasks 2, 3, 5.
- `MoveEventSource` declared in `MoveEventModal.tsx` and re-imported into `MainScreen.tsx` in Task 5 — same shape on both sides.
- `LogEntry` already used by `LogRow`; `startMoveEvent(entry: LogEntry)` matches.
- Modal-state union extension in Task 5 matches existing pattern (`{ kind: 'move-event'; source: MoveEventSource }`).

**Risks called out:**
- Task 4 removes the inline follow-up arrow. If Task 3 hasn't shipped first, follow-up is briefly unreachable. Tasks must run in order.
- The Move flow uses `addWorkingDayOffset` (same helper as FollowUpModal). For backward custom dates, the user picks a date directly via the calendar — no working-day offset involved. The "Move with same date as source" no-op is explicitly handled.
