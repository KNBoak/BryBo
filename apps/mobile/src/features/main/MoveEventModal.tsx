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
              <Button label="Move" onPress={handleSave} disabled={!canSave || saving} loading={saving} />
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
