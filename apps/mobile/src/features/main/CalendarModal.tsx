import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { useDataStore } from '../../stores/dataStore';
import { generateId } from '../../utils/ids';
import { logError } from '../../utils/debug';
import { Button } from '../../components/ui';
import { isWeekend, isWorkingDay, today as todayIso } from '@brybo/shared';
import type { Day as StoreDay, NonWorkingReason } from '@brybo/shared';

interface Props {
  visible: boolean;
  viewDate: string;
  onPick: (iso: string) => void;
  onClose: () => void;
  /**
   * When true, suppresses the long-press "mark as not working" affordance.
   * Used when the modal is being shown as a one-shot date picker from a form.
   */
  hideWorkingDayToggle?: boolean;
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const REASON_OPTIONS: { value: NonWorkingReason; label: string; emoji: string }[] = [
  { value: 'holiday',  label: 'Holiday',  emoji: '🏛️' },
  { value: 'vacation', label: 'Vacation', emoji: '🌴' },
  { value: 'sick',     label: 'Sick',     emoji: '🤒' },
  { value: 'personal', label: 'Personal', emoji: '🏠' },
  { value: 'other',    label: 'Other',    emoji: '·' },
];

const REASON_LABELS: Record<NonWorkingReason, string> = {
  holiday: 'Holiday',
  vacation: 'Vacation',
  sick: 'Sick',
  personal: 'Personal',
  weekend: 'Weekend',
  other: 'Other',
};

const REASON_EMOJI: Record<NonWorkingReason, string> = {
  holiday: '🏛️',
  vacation: '🌴',
  sick: '🤒',
  personal: '🏠',
  weekend: '🌙',
  other: '🌴',
};

function isoFor(year: number, monthZeroBased: number, day: number): string {
  const m = String(monthZeroBased + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function formatLongDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function CalendarModal({ visible, viewDate, onPick, onClose, hideWorkingDayToggle }: Props) {
  const initialAnchor = useMemo(() => {
    const [y, m] = viewDate.split('-').map(Number);
    return { year: y, month: m - 1 };
  }, [viewDate]);

  const [anchor, setAnchor] = useState(initialAnchor);

  React.useEffect(() => {
    if (visible) setAnchor(initialAnchor);
  }, [visible, initialAnchor]);

  const today = todayIso();

  const activeUserId = useDataStore((s) => s.activeUserId);
  const days = useDataStore((s) => s.days);
  const events = useDataStore((s) => s.events);
  const upsertDay = useDataStore((s) => s.upsertDay);

  const userDays = useMemo(
    () => days.filter((d) => d.user_id === activeUserId),
    [days, activeUserId],
  );
  const dayByDate = useMemo(() => {
    const m = new Map<string, StoreDay>();
    for (const d of userDays) m.set(d.date, d);
    return m;
  }, [userDays]);

  const datesWithLog = useMemo(() => {
    const dateById = new Map(userDays.map((d) => [d.id, d.date]));
    const out = new Set<string>();
    for (const e of events) {
      if (e.is_cancelled) continue;
      const date = dateById.get(e.day_id);
      if (date) out.add(date);
    }
    return out;
  }, [userDays, events]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(anchor.year, anchor.month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(anchor.year, anchor.month + 1, 0).getDate();
    const prevMonthDays = new Date(anchor.year, anchor.month, 0).getDate();

    const out: { iso: string; day: number; inMonth: boolean }[] = [];
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = anchor.month === 0 ? 11 : anchor.month - 1;
      const y = anchor.month === 0 ? anchor.year - 1 : anchor.year;
      out.push({ iso: isoFor(y, m, d), day: d, inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ iso: isoFor(anchor.year, anchor.month, d), day: d, inMonth: true });
    }
    while (out.length % 7 !== 0) {
      const lastIso = out[out.length - 1].iso;
      const [ly, lm, ld] = lastIso.split('-').map(Number);
      const next = new Date(ly, lm - 1, ld + 1);
      out.push({
        iso: isoFor(next.getFullYear(), next.getMonth(), next.getDate()),
        day: next.getDate(),
        inMonth: false,
      });
    }
    return out;
  }, [anchor]);

  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const stepMonth = (delta: number) => {
    const m = anchor.month + delta;
    if (m < 0) setAnchor({ year: anchor.year - 1, month: 11 });
    else if (m > 11) setAnchor({ year: anchor.year + 1, month: 0 });
    else setAnchor({ year: anchor.year, month: m });
  };

  // Reason picker state — shown when marking a working day non-working.
  const [reasonPickerDate, setReasonPickerDate] = useState<string | null>(null);

  const setNonWorking = async (iso: string, reason: NonWorkingReason) => {
    if (!activeUserId) return;
    const existing = dayByDate.get(iso);
    const nowIso = new Date().toISOString();
    const next: StoreDay = existing
      ? { ...existing, is_working_day: false, non_working_reason: reason, updated_at: nowIso }
      : {
          id: generateId(),
          user_id: activeUserId,
          date: iso,
          notes: null,
          is_working_day: false,
          non_working_reason: reason,
          created_at: nowIso,
          updated_at: nowIso,
        };
    try {
      await upsertDay(next);
    } catch (e) {
      logError('CalendarModal', 'setNonWorking threw', e);
    }
  };

  const setWorking = async (iso: string) => {
    if (!activeUserId) return;
    const existing = dayByDate.get(iso);
    const nowIso = new Date().toISOString();
    // Set is_working_day = true to override the weekend default (e.g. user
    // works Saturdays). Clear any reason.
    const next: StoreDay = existing
      ? { ...existing, is_working_day: true, non_working_reason: undefined, updated_at: nowIso }
      : {
          id: generateId(),
          user_id: activeUserId,
          date: iso,
          notes: null,
          is_working_day: true,
          created_at: nowIso,
          updated_at: nowIso,
        };
    try {
      await upsertDay(next);
    } catch (e) {
      logError('CalendarModal', 'setWorking threw', e);
    }
  };

  const handleLongPress = (iso: string, inMonth: boolean) => {
    if (hideWorkingDayToggle) return;
    if (!inMonth) return;
    const record = dayByDate.get(iso);
    const working = isWorkingDay(iso, record);
    const long = formatLongDate(iso);

    if (!working) {
      // Currently non-working — offer to unmark.
      const isWeekendDay = isWeekend(iso);
      const reason = record?.non_working_reason;
      const reasonLabel = reason
        ? REASON_LABELS[reason]
        : isWeekendDay ? 'Weekend' : null;
      const message = reasonLabel
        ? `Currently marked as ${reasonLabel.toLowerCase()}. Treat as a working day again?`
        : 'Treat this as a working day again. Follow-up offsets will no longer skip it.';
      Alert.alert(
        `Unmark ${long}?`,
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Mark working', onPress: () => setWorking(iso) },
        ],
      );
    } else {
      // Currently working — open reason picker.
      setReasonPickerDate(iso);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <Pressable
              style={styles.navBtn}
              onPress={() => stepMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              hitSlop={8}
            >
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.title}>{MONTH_LABELS[anchor.month]} {anchor.year}</Text>
              <Pressable
                style={styles.todayJumpBtn}
                onPress={() => onPick(today)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Jump to today"
              >
                <Text style={styles.todayJumpBtnText}>⊙</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.navBtn}
              onPress={() => stepMonth(1)}
              accessibilityRole="button"
              accessibilityLabel="Next month"
              hitSlop={8}
            >
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.dowRow}>
            {DOW_LABELS.map((d) => (
              <View key={d} style={styles.dowCell}>
                <Text style={styles.dowLabel}>{d}</Text>
              </View>
            ))}
          </View>

          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((c) => {
                const record = dayByDate.get(c.iso);
                const working = isWorkingDay(c.iso, record);
                const isSelected = c.iso === viewDate;
                const isToday = c.iso === today;
                const hasLog = datesWithLog.has(c.iso);
                const isNonWorking = !working;
                const reason: NonWorkingReason | undefined = isNonWorking
                  ? (record?.non_working_reason ?? (isWeekend(c.iso) ? 'weekend' : 'other'))
                  : undefined;
                return (
                  <Pressable
                    key={c.iso}
                    style={[
                      styles.cell,
                      !c.inMonth && styles.cellOut,
                      isNonWorking && styles.cellNonWorking,
                      isToday && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                    onPress={() => onPick(c.iso)}
                    onLongPress={() => handleLongPress(c.iso, c.inMonth)}
                    delayLongPress={350}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        !c.inMonth && styles.dayNumOut,
                        isNonWorking && !isSelected && styles.dayNumNonWorking,
                        isToday && styles.dayNumToday,
                        isSelected && styles.dayNumSelected,
                      ]}
                    >
                      {c.day}
                    </Text>
                    {reason && (
                      <Text style={styles.holidayMark}>{REASON_EMOJI[reason]}</Text>
                    )}
                    {hasLog && (
                      <View style={[styles.logDot, isSelected && styles.logDotSelected]} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}

          {!hideWorkingDayToggle && (
            <Text style={styles.hint}>Long-press a date to mark as not working.</Text>
          )}

          <View style={styles.footerRow}>
            <Button label="Close" onPress={onClose} variant="ghost" size="sm" />
          </View>
        </Pressable>
      </Pressable>

      {/* Reason picker for marking a day non-working */}
      <Modal
        visible={reasonPickerDate != null}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonPickerDate(null)}
      >
        <Pressable style={styles.overlay} onPress={() => setReasonPickerDate(null)}>
          <Pressable style={styles.reasonSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.reasonTitle}>
              {reasonPickerDate ? `Mark ${formatLongDate(reasonPickerDate)}` : ''}
            </Text>
            <Text style={styles.reasonSub}>Why is this day not working?</Text>
            {REASON_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={styles.reasonRow}
                onPress={() => {
                  if (reasonPickerDate) {
                    const date = reasonPickerDate;
                    setReasonPickerDate(null);
                    setNonWorking(date, opt.value);
                  }
                }}
              >
                <Text style={styles.reasonEmoji}>{opt.emoji}</Text>
                <Text style={styles.reasonLabel}>{opt.label}</Text>
              </Pressable>
            ))}
            <View style={styles.reasonCancelWrap}>
              <Button
                label="Cancel"
                onPress={() => setReasonPickerDate(null)}
                variant="ghost"
                size="sm"
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'center',
    padding: spacing[4],
  },
  sheet: {
    backgroundColor: colors.bg.sunken,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    padding: spacing[3],
    gap: spacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  todayJumpBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.status.todayBg,
    borderWidth: 0.5,
    borderColor: colors.interactive.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayJumpBtnText: {
    color: colors.status.todayText,
    fontSize: 14,
    fontWeight: typography.weight.bold,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  navBtnText: {
    fontSize: typography.size.lg,
    color: colors.text.primary,
  },
  dowRow: { flexDirection: 'row' },
  dowCell: { flex: 1, alignItems: 'center', paddingVertical: spacing[1] },
  dowLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
  },
  row: { flexDirection: 'row', marginBottom: 2 },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  cellOut: { opacity: 0.35 },
  cellNonWorking: { opacity: 0.55 },
  cellToday: {
    backgroundColor: colors.status.todayBg,
    borderWidth: 1.5,
    borderColor: colors.interactive.primary,
  },
  cellSelected: {
    backgroundColor: colors.interactive.primary,
    opacity: 1,
  },
  dayNum: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  dayNumOut: { color: colors.text.disabled },
  dayNumNonWorking: { color: colors.text.secondary },
  dayNumToday: {
    color: colors.status.todayText,
    fontWeight: typography.weight.bold,
  },
  dayNumSelected: {
    color: '#fff',
    fontWeight: typography.weight.bold,
  },
  holidayMark: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 9,
  },
  logDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.interactive.primary,
  },
  logDotSelected: { backgroundColor: '#fff' },
  hint: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing[2],
    gap: spacing[2],
  },
  reasonSheet: {
    backgroundColor: colors.bg.sunken,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    padding: spacing[3],
    gap: spacing[1],
  },
  reasonTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  reasonSub: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginBottom: spacing[2],
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.muted,
  },
  reasonEmoji: { fontSize: 18 },
  reasonLabel: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  reasonCancelWrap: {
    alignSelf: 'flex-end',
    marginTop: spacing[2],
  },
});
