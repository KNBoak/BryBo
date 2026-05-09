import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { useDataStore } from '../../stores/dataStore';
import { generateId } from '../../utils/ids';
import { logError } from '../../utils/debug';
import { Button } from '../../components/ui';
import { CalendarModal } from './CalendarModal';
import { EntityPickerModal, type PickerItem } from './EntityPickerModal';
import {
  buildWorkingDayLookup,
  addWorkingDayOffset,
  EVENT_TYPES,
  type OffsetResult,
} from '@brybo/shared';
import type { Event as StoreEvent, Day as StoreDay } from '@brybo/shared';

const TAG = 'FollowUpModal';

export interface FollowUpSource {
  eventId: string;
  sourceDate: string;          // YYYY-MM-DD of the original event's day
  sourceType: string;
  sourceNotes: string | null;
  accountIds: string[];
  contactIds: string[];
}

interface Props {
  visible: boolean;
  source: FollowUpSource | null;
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

export function FollowUpModal({ visible, source, onClose, onNavigateToDate }: Props) {
  const activeUserId = useDataStore((s) => s.activeUserId);
  const storeAccounts = useDataStore((s) => s.accounts);
  const storeContacts = useDataStore((s) => s.contacts);
  const storeDays = useDataStore((s) => s.days);
  const upsertEvent = useDataStore((s) => s.upsertEvent);
  const upsertDay = useDataStore((s) => s.upsertDay);

  const [presetIdx, setPresetIdx] = useState<number | null>(0);
  const [customDate, setCustomDate] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [notes, setNotes] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [contactIds, setContactIds] = useState<string[]>([]);
  const [type, setType] = useState<string>('call');
  const [picker, setPicker] = useState<'none' | 'account' | 'contact'>('none');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !source) return;
    setPresetIdx(0);
    setCustomDate(null);
    setShowCalendar(false);
    // Pre-fill notes with "follow-up from <date>" so the relationship is
    // legible in the daily log even when the user doesn't customize.
    setNotes(`follow-up from ${formatDate(source.sourceDate)}`);
    setAccountIds([...source.accountIds]);
    setContactIds([...source.contactIds]);
    setType(source.sourceType || 'call');
    setPicker('none');
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

  const userAccounts = useMemo(
    () => storeAccounts.filter((a) => a.user_id === activeUserId),
    [storeAccounts, activeUserId],
  );
  const userContacts = useMemo(
    () => storeContacts.filter((c) => c.user_id === activeUserId),
    [storeContacts, activeUserId],
  );

  // Selected accounts/contacts (chip display).
  const linkedAccts = useMemo(
    () => userAccounts.filter((a) => accountIds.includes(a.id)),
    [userAccounts, accountIds],
  );
  const linkedConts = useMemo(
    () => userContacts.filter((c) => contactIds.includes(c.id)),
    [userContacts, contactIds],
  );

  // Picker items — sorted alphabetically. The user can search.
  const accountPickerItems: PickerItem[] = useMemo(() =>
    [...userAccounts]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({ id: a.id, label: a.name, sublabel: a.city ?? undefined })),
    [userAccounts],
  );

  const contactPickerItems: PickerItem[] = useMemo(() => {
    const accountById = new Map(userAccounts.map((a) => [a.id, a.name]));
    return [...userContacts]
      .sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
      )
      .map((c) => ({
        id: c.id,
        label: `${c.first_name} ${c.last_name}`.trim() || '—',
        sublabel: c.account_id ? accountById.get(c.account_id) ?? undefined : undefined,
      }));
  }, [userContacts, userAccounts]);

  const selectedDateIsNonWorking = resolved
    ? !isWorking(resolved.date) && resolved.isCustom
    : false;

  const canSave = !!activeUserId && !!source && !!resolved;

  const removeAccount = (id: string) => {
    setAccountIds((prev) => prev.filter((x) => x !== id));
  };
  const removeContact = (id: string) => {
    setContactIds((prev) => prev.filter((x) => x !== id));
  };

  const handleSave = async () => {
    if (!canSave || !activeUserId || !source || !resolved) return;
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

      const event: StoreEvent = {
        id: generateId(),
        user_id: activeUserId,
        day_id: day.id,
        type,
        status: 'todo',
        notes: notes.trim() || null,
        amount: null,
        is_cancelled: false,
        source_event_id: source.eventId,
        created_at: now,
        updated_at: now,
      };

      await upsertEvent(event, accountIds, contactIds);

      const resolvedDate = resolved.date;
      onClose();
      Alert.alert(
        'Follow-up created',
        `Added on ${formatLong(resolvedDate)}.`,
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
    // Render an empty modal so the open/close animation is consistent.
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose} />
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Add follow-up</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            {/* Source summary */}
            <View style={styles.sourceCard}>
              <Text style={styles.sourceLabel}>Following up on</Text>
              <Text style={styles.sourceText} numberOfLines={2}>
                {source.sourceNotes?.trim() || `(${source.sourceType || 'event'})`}
              </Text>
              <Text style={styles.sourceDate}>Originally {formatDate(source.sourceDate)}</Text>
            </View>

            {/* When */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>When</Text>
              <View style={styles.pillRow}>
                {PRESETS.map((p, idx) => {
                  const active = presetIdx === idx && customDate == null;
                  return (
                    <Pressable
                      key={p.label}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => { setPresetIdx(idx); setCustomDate(null); }}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{p.label}</Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.pill, customDate != null && styles.pillActive]}
                  onPress={() => setShowCalendar(true)}
                >
                  <Text style={[styles.pillText, customDate != null && styles.pillTextActive]}>
                    {customDate != null ? `📅 ${formatDate(customDate)}` : '📅 Custom…'}
                  </Text>
                </Pressable>
              </View>

              {resolved && (
                <View style={styles.resolvedBlock}>
                  <Text style={styles.resolvedDate}>→ {formatDate(resolved.date)}</Text>
                  {resolved.offset?.wasAdjusted && (
                    <Text style={styles.adjustedHint}>
                      Adjusted from {formatDate(resolved.offset.rawTarget)} (not working)
                    </Text>
                  )}
                  {selectedDateIsNonWorking && (
                    <Text style={styles.warnHint}>
                      🌴 Heads up — this day is marked not working.
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Type pills */}
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

            {/* Notes */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Notes</Text>
              <TextInput
                style={[fieldStyles.input, fieldStyles.inputMulti]}
                value={notes}
                onChangeText={setNotes}
                multiline
                placeholder="What's the follow-up about?"
                placeholderTextColor={colors.form.inputPlaceholder}
              />
            </View>

            {/* Accounts */}
            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Linked accounts</Text>
              {linkedAccts.length > 0 && (
                <View style={styles.chipRow}>
                  {linkedAccts.map((a) => (
                    <Pressable
                      key={a.id}
                      style={styles.acctChip}
                      onPress={() => removeAccount(a.id)}
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

            {/* Contacts */}
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
                        onPress={() => removeContact(c.id)}
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

          </ScrollView>

          <View style={styles.actions}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="sm" />
            <Button
              label="Create follow-up"
              onPress={handleSave}
              variant="primary"
              size="sm"
              disabled={!canSave}
              loading={saving}
            />
          </View>
        </Pressable>
      </Pressable>

      <CalendarModal
        visible={showCalendar}
        viewDate={resolved?.date ?? source.sourceDate}
        onPick={(iso) => {
          setCustomDate(iso);
          setPresetIdx(null);
          setShowCalendar(false);
        }}
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
    minHeight: 70,
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
  scroll: { maxHeight: 540 },
  body: {
    padding: spacing[3],
    gap: spacing[3],
  },
  sourceCard: {
    padding: spacing[3],
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    gap: 2,
  },
  sourceLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  sourceText: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
  },
  sourceDate: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginTop: 2,
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
  resolvedBlock: {
    marginTop: spacing[1] + 2,
    gap: 2,
  },
  resolvedDate: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
  },
  adjustedHint: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  warnHint: {
    fontSize: typography.size.xs,
    color: colors.text.danger,
    fontStyle: 'italic',
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
