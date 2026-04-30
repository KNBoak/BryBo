import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../theme';
import { Badge, SectionHeader, EmptyState } from '../../components/ui';
import { useDataStore } from '../../stores/dataStore';
import { formatEventType, formatCurrency, formatDate } from '@brybo/shared';

interface Props {
  id: string;
}

export function EventDetailScreen({ id }: Props) {
  const router = useRouter();
  const events = useDataStore((s) => s.events);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const eventContacts = useDataStore((s) => s.eventContacts);
  const accounts = useDataStore((s) => s.accounts);
  const contacts = useDataStore((s) => s.contacts);
  const days = useDataStore((s) => s.days);
  const cancelEvent = useDataStore((s) => s.cancelEvent);
  const deleteEvent = useDataStore((s) => s.deleteEvent);

  const event = events.find((e) => e.id === id);

  if (!event) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState title="Event not found" />
      </SafeAreaView>
    );
  }

  const day = days.find((d) => d.id === event.day_id);
  const linkedAccounts = accounts.filter((a) =>
    eventAccounts.some((ea) => ea.event_id === id && ea.account_id === a.id),
  );
  const linkedContacts = contacts.filter((c) =>
    eventContacts.some((ec) => ec.event_id === id && ec.contact_id === c.id),
  );

  const handleCancel = () => {
    Alert.alert('Cancel Event', 'Mark this event as cancelled?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelEvent(id) },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Event', 'Permanently delete this event? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEvent(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Badge
              label={formatEventType(event.type)}
              variant={event.is_cancelled ? 'cancelled' : event.amount ? 'sale' : 'default'}
            />
            {event.is_cancelled && <Badge label="Cancelled" variant="cancelled" />}
            <Pressable
              onPress={() => router.push(`/events/${id}/edit`)}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          {day && (
            <Text style={styles.dateText}>{formatDate(day.date)}</Text>
          )}
          {event.amount !== null && (
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Sale Amount</Text>
              <Text style={styles.amountValue}>{formatCurrency(event.amount)}</Text>
            </View>
          )}
        </View>

        {/* Notes */}
        {event.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <Text style={styles.notes}>{event.notes}</Text>
          </View>
        )}

        {/* Linked accounts */}
        {linkedAccounts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title={`Accounts (${linkedAccounts.length})`} />
            {linkedAccounts.map((a) => (
              <Pressable
                key={a.id}
                style={styles.linkedRow}
                onPress={() => router.push(`/accounts/${a.id}`)}
              >
                <Text style={styles.linkedName}>{a.name}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Linked contacts */}
        {linkedContacts.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title={`Contacts (${linkedContacts.length})`} />
            {linkedContacts.map((c) => (
              <Pressable
                key={c.id}
                style={styles.linkedRow}
                onPress={() => router.push(`/contacts/${c.id}`)}
              >
                <Text style={styles.linkedName}>
                  {c.first_name} {c.last_name}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          {!event.is_cancelled && (
            <Pressable style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>Cancel Event</Text>
            </Pressable>
          )}
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete Event</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { paddingBottom: spacing[12] },
  header: { padding: spacing[4], backgroundColor: colors.bg.surface, gap: spacing[2] },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  editBtn: { marginLeft: 'auto', paddingHorizontal: spacing[3], paddingVertical: spacing[1], backgroundColor: colors.interactive.secondary, borderRadius: radius.md },
  editBtnText: { color: colors.interactive.secondaryText, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  dateText: { fontSize: typography.size.md, color: colors.text.primary, fontWeight: typography.weight.semibold },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.status.saleBg, padding: spacing[3], borderRadius: radius.md, marginTop: spacing[2] },
  amountLabel: { color: colors.status.saleText, fontSize: typography.size.base },
  amountValue: { color: colors.status.saleText, fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  section: { marginTop: spacing[3] },
  sectionLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: spacing[4], paddingVertical: spacing[2] },
  notes: { paddingHorizontal: spacing[4], fontSize: typography.size.base, color: colors.text.primary, lineHeight: typography.size.base * 1.5 },
  linkedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.muted },
  linkedName: { fontSize: typography.size.base, color: colors.text.primary },
  chevron: { color: colors.text.disabled, fontSize: typography.size.lg },
  actionsSection: { margin: spacing[4], gap: spacing[3] },
  cancelBtn: { padding: spacing[3], backgroundColor: colors.bg.raised, borderRadius: radius.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border.default },
  cancelBtnText: { color: colors.text.secondary, fontWeight: typography.weight.semibold },
  deleteBtn: { padding: spacing[3], backgroundColor: colors.interactive.destructive, borderRadius: radius.md, alignItems: 'center' },
  deleteBtnText: { color: colors.interactive.destructiveText, fontWeight: typography.weight.semibold },
});
