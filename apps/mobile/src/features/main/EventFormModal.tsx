import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { useDataStore } from '../../stores/dataStore';
import { generateId } from '../../utils/ids';
import { logError } from '../../utils/debug';
import { formatUSD } from '../../utils/format';
import { Button } from '../../components/ui';
import { CalendarModal } from './CalendarModal';
import { EntityPickerModal, type PickerItem } from './EntityPickerModal';
import type { Event as StoreEvent, Day as StoreDay } from '@brybo/shared';
import { EVENT_TYPES, today as todayIso } from '@brybo/shared';

const TAG = 'EventFormModal';

export interface EventFormInitial {
  date?: string;                  // YYYY-MM-DD; defaults to today
  accountIds?: string[];          // pre-selected accounts
  contactIds?: string[];          // pre-selected contacts
  type?: string;
  notes?: string;
  amount?: number | null;
  status?: 'todo' | 'done';
  title?: string;                 // header label, e.g. "New event for Acme"
  /** When set, contacts list filters to this account's contacts (with a "show all" toggle). */
  primaryAccountId?: string | null;
}

interface Props {
  visible: boolean;
  initial: EventFormInitial;
  onClose: () => void;
  /** Called after successful save with the new (or updated) event id. */
  onSaved?: (eventId: string) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function EventFormModal({ visible, initial, onClose, onSaved }: Props) {
  const activeUserId = useDataStore((s) => s.activeUserId);
  const storeAccounts = useDataStore((s) => s.accounts);
  const storeContacts = useDataStore((s) => s.contacts);
  const storeDays = useDataStore((s) => s.days);
  const upsertEvent = useDataStore((s) => s.upsertEvent);
  const upsertDay = useDataStore((s) => s.upsertDay);

  const today = todayIso();

  const [date, setDate] = useState<string>(initial.date ?? today);
  const [type, setType] = useState<string>(initial.type ?? 'call');
  const [notes, setNotes] = useState<string>(initial.notes ?? '');
  const [amount, setAmount] = useState<string | null>(
    initial.amount != null ? String(initial.amount) : null,
  );
  const [accountIds, setAccountIds] = useState<string[]>(initial.accountIds ?? []);
  const [contactIds, setContactIds] = useState<string[]>(initial.contactIds ?? []);
  const [showCalendar, setShowCalendar] = useState(false);
  const [picker, setPicker] = useState<'none' | 'account' | 'contact'>('none');
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (!visible) return;
    setDate(initial.date ?? todayIso());
    setType(initial.type ?? 'call');
    setNotes(initial.notes ?? '');
    setAmount(initial.amount != null ? String(initial.amount) : null);
    setAccountIds(initial.accountIds ?? []);
    setContactIds(initial.contactIds ?? []);
    setShowCalendar(false);
    setPicker('none');
  }, [visible, initial]);

  // Status auto-resolves: explicit > sale-default (done) > date-based.
  const isSaleDraft = amount != null && (amount ?? '').trim() !== '';
  const status: 'todo' | 'done' =
    initial.status ?? (isSaleDraft ? 'done' : (date < today ? 'done' : 'todo'));
  // Sales are record-keeping notes; outstanding (todo) interactions are tasks.
  const kind: 'note' | 'task' = isSaleDraft ? 'note' : (status === 'todo' ? 'task' : 'note');

  const userAccounts = useMemo(
    () => storeAccounts.filter((a) => a.user_id === activeUserId),
    [storeAccounts, activeUserId],
  );
  const userContacts = useMemo(
    () => storeContacts.filter((c) => c.user_id === activeUserId),
    [storeContacts, activeUserId],
  );

  // Selected accounts and contacts (for chip display).
  const linkedAccts = useMemo(
    () => userAccounts.filter((a) => accountIds.includes(a.id)),
    [userAccounts, accountIds],
  );
  const linkedConts = useMemo(
    () => userContacts.filter((c) => contactIds.includes(c.id)),
    [userContacts, contactIds],
  );

  // Picker items — accounts always show all, contacts default to primary
  // account but can show all via toggle.
  const accountPickerItems: PickerItem[] = useMemo(() =>
    [...userAccounts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({
        id: a.id,
        label: a.name,
        sublabel: a.city ?? undefined,
      })),
    [userAccounts],
  );

  // Contacts: when a primary account is set, surface its contacts at the top
  // for quick discovery; the rest follow alphabetically. Search still works
  // across the full list.
  const contactPickerItems: PickerItem[] = useMemo(() => {
    const accountById = new Map(userAccounts.map((a) => [a.id, a.name]));
    const primaryId = initial.primaryAccountId;
    return [...userContacts]
      .sort((a, b) => {
        if (primaryId) {
          const aPri = a.account_id === primaryId;
          const bPri = b.account_id === primaryId;
          if (aPri !== bPri) return aPri ? -1 : 1;
        }
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      })
      .map((c) => ({
        id: c.id,
        label: `${c.first_name} ${c.last_name}`.trim() || '—',
        sublabel: c.account_id ? accountById.get(c.account_id) ?? undefined : undefined,
      }));
  }, [userContacts, userAccounts, initial.primaryAccountId]);

  const hasAmount = amount != null;
  const amountStr = (amount ?? '').trim();
  const parsedAmount = parseFloat(amountStr);
  const amountValid = !hasAmount || (amountStr.length > 0 && !isNaN(parsedAmount));
  const saleAccountValid = !hasAmount || accountIds.length === 1;
  const notesValid = hasAmount ? true : notes.trim().length > 0;

  const canSave = !!activeUserId && amountValid && saleAccountValid && notesValid;
  const blockedReason =
    !notesValid ? 'Add notes (or remove the amount field).'
    : !amountValid ? 'Enter a valid sale amount.'
    : !saleAccountValid ? `A sale needs exactly one account (you have ${accountIds.length}).`
    : null;

  const toggleAccount = (id: string) => {
    setAccountIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const toggleContact = (id: string) => {
    setContactIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!canSave || !activeUserId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      let day = storeDays.find((d) => d.user_id === activeUserId && d.date === date);
      if (!day) {
        day = {
          id: generateId(),
          user_id: activeUserId,
          date,
          notes: null,
          created_at: now,
          updated_at: now,
        } as StoreDay;
        await upsertDay(day);
      }

      const trimmedNotes = notes.trim();
      const finalNotes =
        hasAmount && trimmedNotes === ''
          ? `sale: ${formatUSD(parsedAmount)}`
          : trimmedNotes || null;

      const event: StoreEvent = {
        id: generateId(),
        user_id: activeUserId,
        day_id: day.id,
        type: hasAmount ? 'sale' : type,
        kind,
        status,
        notes: finalNotes,
        amount: hasAmount ? parsedAmount : null,
        is_cancelled: false,
        source_event_id: null,
        created_at: now,
        updated_at: now,
      };

      await upsertEvent(event, accountIds, contactIds);
      onSaved?.(event.id);
      onClose();
    } catch (e) {
      logError(TAG, 'handleSave threw', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{initial.title ?? 'New event'}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Date */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Date</Text>
              <Pressable style={styles.dateBtn} onPress={() => setShowCalendar(true)}>
                <Text style={styles.dateBtnText}>📅  {formatDate(date)}</Text>
              </Pressable>
            </View>

            {/* Type pills (hidden when this is a sale entry) */}
            {!hasAmount && (
              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>Type</Text>
                <View style={styles.pillRow}>
                  {EVENT_TYPES.map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.pill, type === t && styles.pillActive]}
                      onPress={() => setType(t)}
                    >
                      <Text style={[styles.pillText, type === t && styles.pillTextActive]}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Notes</Text>
              <TextInput
                style={[fieldStyles.input, fieldStyles.inputMulti]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder={hasAmount ? 'Optional notes for this sale' : 'What happened, or what needs to happen?'}
                placeholderTextColor={colors.form.inputPlaceholder}
              />
            </View>

            {/* Amount toggle */}
            {hasAmount ? (
              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>Amount</Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amountIcon}>$</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="decimal-pad"
                    value={amount ?? ''}
                    onChangeText={(v) => setAmount(v)}
                    placeholder="0.00"
                    placeholderTextColor={colors.form.inputPlaceholder}
                  />
                  <Pressable onPress={() => setAmount(null)}>
                    <Text style={styles.removeLink}>remove</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.addAmountBtn} onPress={() => setAmount('')}>
                <Text style={styles.addAmountBtnText}>$ + Add sale amount</Text>
              </Pressable>
            )}

            {/* Linked accounts */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Linked accounts</Text>
              {linkedAccts.length > 0 && (
                <View style={styles.chipRow}>
                  {linkedAccts.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.acctChip}
                      onPress={() => toggleAccount(a.id)}
                    >
                      <Text style={styles.acctChipText}>🏢 {a.name} ×</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <Pressable style={styles.linkBtn} onPress={() => setPicker('account')}>
                <Text style={styles.linkBtnText}>🏢 + Link account</Text>
              </Pressable>
            </View>

            {/* Linked contacts */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Linked contacts</Text>
              {linkedConts.length > 0 && (
                <View style={styles.chipRow}>
                  {linkedConts.map((c) => {
                    const fullName = `${c.first_name} ${c.last_name}`.trim() || '—';
                    return (
                      <Pressable
                        key={c.id}
                        style={styles.contChip}
                        onPress={() => toggleContact(c.id)}
                      >
                        <Text style={styles.contChipText}>👤 {fullName} ×</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <Pressable style={styles.linkBtn} onPress={() => setPicker('contact')}>
                <Text style={styles.linkBtnText}>👤 + Link contact</Text>
              </Pressable>
            </View>

            {blockedReason && <Text style={styles.blockedHint}>{blockedReason}</Text>}
          </ScrollView>

          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="sm" />
            <Button
              label="Save"
              onPress={handleSave}
              variant="primary"
              size="sm"
              disabled={!canSave}
              loading={saving}
            />
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>

      <CalendarModal
        visible={showCalendar}
        viewDate={date}
        onPick={(iso) => { setDate(iso); setShowCalendar(false); }}
        onClose={() => setShowCalendar(false)}
        hideWorkingDayToggle
      />

      <EntityPickerModal
        visible={picker === 'account'}
        title="Link an account"
        items={accountPickerItems}
        excludeIds={accountIds}
        emoji="🏢"
        iconBg={colors.status.todayBg}
        iconText={colors.status.todayText}
        onPick={(id) => { setAccountIds((prev) => [...prev, id]); setPicker('none'); }}
        onClose={() => setPicker('none')}
      />

      <EntityPickerModal
        visible={picker === 'contact'}
        title="Link a contact"
        items={contactPickerItems}
        excludeIds={contactIds}
        emoji="👤"
        iconBg={colors.status.customerBg}
        iconText={colors.status.customerText}
        onPick={(id) => { setContactIds((prev) => [...prev, id]); setPicker('none'); }}
        onClose={() => setPicker('none')}
      />
    </Modal>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  label: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
  input: {
    backgroundColor: colors.form.inputBg,
    borderWidth: 1,
    borderColor: colors.form.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.form.inputText,
    fontSize: typography.size.sm,
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
    padding: spacing[4],
  },
  sheet: {
    backgroundColor: colors.bg.sunken,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  title: {
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
  scroll: { maxHeight: 520 },
  body: {
    padding: spacing[3],
    gap: spacing[3],
  },
  dateBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.form.inputBorder,
    backgroundColor: colors.form.inputBg,
  },
  dateBtnText: {
    color: colors.text.primary,
    fontSize: typography.size.sm,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1] + 2,
  },
  pill: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  pillActive: {
    backgroundColor: colors.interactive.primary,
    borderColor: colors.interactive.primary,
  },
  pillText: {
    fontSize: typography.size.xs,
    color: colors.text.primary,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: typography.weight.medium,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: colors.form.inputBg,
    borderWidth: 1,
    borderColor: colors.form.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
  },
  amountIcon: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
  },
  amountInput: {
    flex: 1,
    paddingVertical: spacing[2],
    color: colors.form.inputText,
    fontSize: typography.size.sm,
  },
  removeLink: {
    color: colors.text.link,
    fontSize: typography.size.xs,
  },
  addAmountBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  addAmountBtnText: {
    color: colors.text.link,
    fontSize: typography.size.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[1] + 2,
    marginBottom: spacing[1],
  },
  acctChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.status.todayBg,
    borderWidth: 0.5,
    borderColor: colors.interactive.primary,
  },
  acctChipText: {
    color: colors.status.todayText,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  contChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.status.customerBg,
    borderWidth: 0.5,
    borderColor: colors.status.customerText,
  },
  contChipText: {
    color: colors.status.customerText,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  linkBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  linkBtnText: {
    color: colors.text.link,
    fontSize: typography.size.xs,
  },
  blockedHint: {
    fontSize: typography.size.xs,
    color: colors.text.danger,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[2],
    padding: spacing[3],
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
    backgroundColor: colors.bg.surface,
  },
});
