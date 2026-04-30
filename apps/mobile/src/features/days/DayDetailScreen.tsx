import React, { useState } from 'react';
import { generateId } from '../../utils/ids';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../theme';
import { Badge, SectionHeader, Divider, EmptyState } from '../../components/ui';
import { useDay, useEventsForDate, useDaySummary } from './hooks/useDays';
import { useDataStore } from '../../stores/dataStore';
import { formatDate, formatCurrency, formatEventType, today as getToday } from '@brybo/shared';
import type { Event } from '@brybo/shared';

interface Props {
  date: string;
  showAiStub?: React.ReactNode;
}

export function DayDetailScreen({ date, showAiStub }: Props) {
  const router = useRouter();
  const day = useDay(date);
  const events = useEventsForDate(date);
  const summary = useDaySummary(date);
  const accounts = useDataStore((s) => s.accounts);
  const contacts = useDataStore((s) => s.contacts);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const eventContacts = useDataStore((s) => s.eventContacts);
  const upsertDay = useDataStore((s) => s.upsertDay);
  const activeUserId = useDataStore((s) => s.activeUserId)!;

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(day?.notes ?? '');

  const todayStr = getToday();
  const isPast = date < todayStr;
  const isFuture = date > todayStr;
  const isToday = date === todayStr;

  const pastEvents = events.filter((e) => !e.is_cancelled);
  const cancelledEvents = events.filter((e) => e.is_cancelled);

  const handleSaveNotes = async () => {
    const now = new Date().toISOString();
    if (day) {
      await upsertDay({ ...day, notes: notesValue.trim() || null, updated_at: now });
    } else {
      const newDay = {
        id: generateId(),
        user_id: activeUserId,
        date,
        notes: notesValue.trim() || null,
        created_at: now,
        updated_at: now,
      };
      await upsertDay(newDay);
    }
    setEditingNotes(false);
  };

  const getEventLinkedAccounts = (event: Event) =>
    accounts.filter((a) =>
      eventAccounts.some((ea) => ea.event_id === event.id && ea.account_id === a.id),
    );

  const getEventLinkedContacts = (event: Event) =>
    contacts.filter((c) =>
      eventContacts.some((ec) => ec.event_id === event.id && ec.contact_id === c.id),
    );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Date header */}
        <View style={[styles.header, isToday && styles.headerToday]}>
          <View style={styles.headerTop}>
            <Text style={styles.dateText}>{formatDate(date)}</Text>
            {isToday && <Badge label="Today" variant="today" />}
          </View>
        </View>

        {/* AI summary stub slot */}
        {showAiStub}

        {/* Summary cards */}
        {(summary.accountCount > 0 || summary.contactCount > 0 || summary.totalSales > 0) && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{summary.accountCount}</Text>
              <Text style={styles.summaryLabel}>Accounts</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryNum}>{summary.contactCount}</Text>
              <Text style={styles.summaryLabel}>Contacts</Text>
            </View>
            {summary.totalSales > 0 && (
              <View style={[styles.summaryCard, styles.summaryCardSale]}>
                <Text style={[styles.summaryNum, styles.summaryNumSale]}>
                  {formatCurrency(summary.totalSales)}
                </Text>
                <Text style={[styles.summaryLabel, styles.summaryLabelSale]}>Sales</Text>
              </View>
            )}
          </View>
        )}

        {/* Day notes */}
        <View style={styles.section}>
          <SectionHeader
            title="Day Notes"
            actionLabel={editingNotes ? 'Save' : 'Edit'}
            onAction={editingNotes ? handleSaveNotes : () => setEditingNotes(true)}
          />
          <View style={styles.notesContent}>
            {editingNotes ? (
              <TextInput
                value={notesValue}
                onChangeText={setNotesValue}
                multiline
                style={styles.notesInput}
                placeholder="Notes for this day..."
                placeholderTextColor={colors.form.inputPlaceholder}
                autoFocus
              />
            ) : (
              <Text style={day?.notes ? styles.notesText : styles.notesEmpty}>
                {day?.notes ?? 'No notes for this day.'}
              </Text>
            )}
          </View>
        </View>

        {/* Events */}
        <View style={styles.section}>
          <SectionHeader
            title={`Events (${events.length})`}
            actionLabel="Add Event"
            onAction={() => router.push({ pathname: '/events/new', params: { date } })}
          />
          {events.length === 0 ? (
            <EmptyState
              title={isToday ? 'Nothing scheduled today' : 'No events this day'}
              subtitle="Tap Add Event to log one."
            />
          ) : (
            <View>
              {pastEvents.map((e, i) => {
                const linkedAccts = getEventLinkedAccounts(e);
                const linkedConts = getEventLinkedContacts(e);
                return (
                  <React.Fragment key={e.id}>
                    {i > 0 && <Divider indent={spacing[4]} />}
                    <Pressable
                      style={styles.eventRow}
                      onPress={() => router.push(`/events/${e.id}`)}
                    >
                      <View style={styles.eventTop}>
                        <Badge label={formatEventType(e.type)} variant={e.amount ? 'sale' : 'default'} />
                        {e.amount !== null && (
                          <Text style={styles.eventAmount}>{formatCurrency(e.amount)}</Text>
                        )}
                        <Text style={styles.chevron}>›</Text>
                      </View>
                      {e.notes && (
                        <Text style={styles.eventNotes} numberOfLines={1}>{e.notes}</Text>
                      )}
                      {linkedAccts.length > 0 && (
                        <Text style={styles.eventMeta} numberOfLines={1}>
                          {linkedAccts.map((a) => a.name).join(', ')}
                        </Text>
                      )}
                      {linkedConts.length > 0 && (
                        <Text style={styles.eventMeta} numberOfLines={1}>
                          {linkedConts.map((c) => `${c.first_name} ${c.last_name}`).join(', ')}
                        </Text>
                      )}
                    </Pressable>
                  </React.Fragment>
                );
              })}
              {cancelledEvents.length > 0 && (
                <Text style={styles.cancelledNote}>
                  {cancelledEvents.length} event{cancelledEvents.length > 1 ? 's' : ''} cancelled
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { paddingBottom: spacing[12] },
  header: { padding: spacing[4], backgroundColor: colors.bg.surface },
  headerToday: { backgroundColor: colors.status.todayBg },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dateText: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary, flex: 1 },
  summaryRow: { flexDirection: 'row', padding: spacing[4], gap: spacing[3] },
  summaryCard: { flex: 1, backgroundColor: colors.bg.surface, borderRadius: radius.md, padding: spacing[3], alignItems: 'center' },
  summaryCardSale: { backgroundColor: colors.status.saleBg },
  summaryNum: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text.primary },
  summaryNumSale: { color: colors.status.saleText, fontSize: typography.size.lg },
  summaryLabel: { fontSize: typography.size.xs, color: colors.text.secondary, marginTop: 2 },
  summaryLabelSale: { color: colors.status.saleText, opacity: 0.85 },
  section: { marginTop: spacing[2] },
  notesContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[3] },
  notesInput: { color: colors.form.inputText, fontSize: typography.size.base, minHeight: 72, textAlignVertical: 'top', backgroundColor: colors.form.inputBg, borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.form.inputFocusBorder },
  notesText: { color: colors.text.primary, fontSize: typography.size.base, lineHeight: typography.size.base * 1.5 },
  notesEmpty: { color: colors.text.disabled, fontSize: typography.size.base },
  eventRow: { paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  eventAmount: { color: colors.status.saleText, fontWeight: typography.weight.semibold, fontSize: typography.size.base, marginLeft: 'auto' },
  chevron: { color: colors.text.disabled, fontSize: typography.size.lg, marginLeft: 'auto' },
  eventNotes: { fontSize: typography.size.sm, color: colors.text.secondary, marginTop: spacing[1] },
  eventMeta: { fontSize: typography.size.xs, color: colors.text.disabled, marginTop: 2 },
  cancelledNote: { paddingHorizontal: spacing[4], paddingVertical: spacing[2], fontSize: typography.size.sm, color: colors.text.disabled },
});
