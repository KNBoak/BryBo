import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../theme';
import { CalendarGrid } from './CalendarGrid';
import { useCalendarMonth } from './hooks/useCalendar';
import { useDataStore } from '../../stores/dataStore';
import { today as getToday } from '@brybo/shared';
import { EVENT_TYPES } from '@brybo/shared';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarScreen() {
  const router = useRouter();
  const todayStr = getToday();
  const [year, setYear] = useState(parseInt(todayStr.slice(0, 4)));
  const [month, setMonth] = useState(parseInt(todayStr.slice(5, 7)));

  const accounts = useDataStore((s) => s.accounts);
  const contacts = useDataStore((s) => s.contacts);

  const [filterAccountId, setFilterAccountId] = useState<string | null>(null);
  const [filterContactId, setFilterContactId] = useState<string | null>(null);
  const [filterEventType, setFilterEventType] = useState<string | null>(null);
  const [showAccountFilter, setShowAccountFilter] = useState(false);
  const [showContactFilter, setShowContactFilter] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');

  const cells = useCalendarMonth(year, month, {
    accountId: filterAccountId,
    contactId: filterContactId,
    eventType: filterEventType,
  });

  const navPrev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const navNext = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const filteredAccounts = useMemo(() => {
    const q = filterSearch.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q));
  }, [accounts, filterSearch]);

  const filteredContacts = useMemo(() => {
    const q = filterSearch.toLowerCase();
    return contacts.filter((c) => `${c.first_name} ${c.last_name}`.toLowerCase().includes(q));
  }, [contacts, filterSearch]);

  const selectedAccountName = accounts.find((a) => a.id === filterAccountId)?.name;
  const selectedContactName = contacts.find((c) => c.id === filterContactId)
    ? `${contacts.find((c) => c.id === filterContactId)?.first_name} ${contacts.find((c) => c.id === filterContactId)?.last_name}`
    : undefined;

  const hasFilters = filterAccountId || filterContactId || filterEventType;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Month navigation */}
        <View style={styles.nav}>
          <Pressable style={styles.navBtn} onPress={navPrev}>
            <Text style={styles.navBtnText}>‹</Text>
          </Pressable>
          <Pressable onPress={() => {
            const d = new Date();
            setYear(d.getFullYear());
            setMonth(d.getMonth() + 1);
          }}>
            <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={navNext}>
            <Text style={styles.navBtnText}>›</Text>
          </Pressable>
        </View>

        {/* Filters */}
        <View style={styles.filters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {/* Account filter */}
            <Pressable
              style={[styles.filterChip, filterAccountId && styles.filterChipActive]}
              onPress={() => { setShowAccountFilter(true); setFilterSearch(''); }}
            >
              <Text style={[styles.filterChipText, filterAccountId && styles.filterChipTextActive]}>
                {selectedAccountName ?? 'Account'}
              </Text>
              {filterAccountId && (
                <Pressable onPress={() => setFilterAccountId(null)}>
                  <Text style={styles.clearChip}> ✕</Text>
                </Pressable>
              )}
            </Pressable>

            {/* Contact filter */}
            <Pressable
              style={[styles.filterChip, filterContactId && styles.filterChipActive]}
              onPress={() => { setShowContactFilter(true); setFilterSearch(''); }}
            >
              <Text style={[styles.filterChipText, filterContactId && styles.filterChipTextActive]}>
                {selectedContactName ?? 'Contact'}
              </Text>
              {filterContactId && (
                <Pressable onPress={() => setFilterContactId(null)}>
                  <Text style={styles.clearChip}> ✕</Text>
                </Pressable>
              )}
            </Pressable>

            {/* Event type filter */}
            {EVENT_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.filterChip, filterEventType === t && styles.filterChipActive]}
                onPress={() => setFilterEventType(filterEventType === t ? null : t)}
              >
                <Text style={[styles.filterChipText, filterEventType === t && styles.filterChipTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Calendar grid */}
        <CalendarGrid
          cells={cells}
          onDayPress={(date) => router.push(`/days/${date}`)}
        />

        {/* Legend */}
        {hasFilters && (
          <View style={styles.legend}>
            <View style={styles.legendDot} />
            <Text style={styles.legendText}>= filtered events</Text>
          </View>
        )}
      </ScrollView>

      {/* Account filter modal */}
      <Modal visible={showAccountFilter} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by Account</Text>
            <TextInput
              value={filterSearch}
              onChangeText={setFilterSearch}
              placeholder="Search..."
              placeholderTextColor={colors.form.inputPlaceholder}
              style={styles.modalSearch}
            />
            <FlatList
              data={filteredAccounts}
              keyExtractor={(a) => a.id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => { setFilterAccountId(item.id); setShowAccountFilter(false); }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  {filterAccountId === item.id && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              )}
            />
            <Pressable onPress={() => setShowAccountFilter(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Contact filter modal */}
      <Modal visible={showContactFilter} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filter by Contact</Text>
            <TextInput
              value={filterSearch}
              onChangeText={setFilterSearch}
              placeholder="Search..."
              placeholderTextColor={colors.form.inputPlaceholder}
              style={styles.modalSearch}
            />
            <FlatList
              data={filteredContacts}
              keyExtractor={(c) => c.id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => { setFilterContactId(item.id); setShowContactFilter(false); }}
                >
                  <Text style={styles.modalItemText}>{item.first_name} {item.last_name}</Text>
                  {filterContactId === item.id && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              )}
            />
            <Pressable onPress={() => setShowContactFilter(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { paddingBottom: spacing[8] },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  navBtn: { padding: spacing[2] },
  navBtnText: { fontSize: typography.size['2xl'], color: colors.text.primary, lineHeight: typography.size['2xl'] },
  monthLabel: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary },
  filters: { paddingBottom: spacing[3] },
  filterScroll: { paddingHorizontal: spacing[3] },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, borderRadius: radius.full, backgroundColor: colors.bg.raised, marginRight: spacing[2] },
  filterChipActive: { backgroundColor: colors.interactive.primary },
  filterChipText: { fontSize: typography.size.sm, color: colors.text.secondary },
  filterChipTextActive: { color: colors.interactive.primaryText, fontWeight: typography.weight.semibold },
  clearChip: { color: colors.interactive.primaryText, fontSize: typography.size.sm },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingTop: spacing[2] },
  legendDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.calendar.dotColor },
  legendText: { fontSize: typography.size.xs, color: colors.text.secondary },
  modalOverlay: { flex: 1, backgroundColor: colors.bg.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[3], maxHeight: '70%' },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary },
  modalSearch: { backgroundColor: colors.form.inputBg, color: colors.form.inputText, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: typography.size.base, borderWidth: 1, borderColor: colors.form.inputBorder },
  modalList: { flexGrow: 0 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.muted },
  modalItemText: { fontSize: typography.size.base, color: colors.text.primary },
  checkmark: { color: colors.interactive.primary, fontSize: typography.size.md },
  closeBtn: { padding: spacing[3], alignItems: 'center' },
  closeBtnText: { color: colors.text.link, fontSize: typography.size.base },
});
