import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../theme';
import { SectionHeader, ContactMethodRow, Badge, EmptyState, Divider } from '../../components/ui';
import { useContact } from './hooks/useContacts';
import { useDataStore } from '../../stores/dataStore';
import { fullName, formatEventType, getEventDayDate } from '@brybo/shared';
import type { Day } from '@brybo/shared';

interface Props {
  id: string;
}

export function ContactDetailScreen({ id }: Props) {
  const router = useRouter();
  const contact = useContact(id);
  const contactMethods = useDataStore((s) => s.contactMethods.filter((m) => m.contact_id === id));
  const eventContacts = useDataStore((s) => s.eventContacts.filter((ec) => ec.contact_id === id));
  const events = useDataStore((s) => s.events);
  const days = useDataStore((s) => s.days);
  const accounts = useDataStore((s) => s.accounts);
  const upsertContact = useDataStore((s) => s.upsertContact);
  const deleteContact = useDataStore((s) => s.deleteContact);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(contact?.notes ?? '');

  if (!contact) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState title="Contact not found" />
      </SafeAreaView>
    );
  }

  const linkedEventIds = new Set(eventContacts.map((ec) => ec.event_id));
  const linkedEvents = events
    .filter((e) => linkedEventIds.has(e.id))
    .sort((a, b) => {
      const da = getEventDayDate(a, days) ?? '';
      const db = getEventDayDate(b, days) ?? '';
      return db.localeCompare(da);
    });
  const account = accounts.find((a) => a.id === contact.account_id);
  const primaryMethod = contactMethods.find((m) => m.is_primary) ?? contactMethods[0];

  const handleSaveNotes = async () => {
    const now = new Date().toISOString();
    await upsertContact({ ...contact, notes: notesValue.trim() || null, updated_at: now }, contactMethods);
    setEditingNotes(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Contact',
      `Delete "${fullName(contact.first_name, contact.last_name)}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteContact(id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {contact.first_name[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{fullName(contact.first_name, contact.last_name)}</Text>
              {contact.title && <Text style={styles.title}>{contact.title}</Text>}
            </View>
            <Pressable
              onPress={() => router.push(`/contacts/${id}/edit`)}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          </View>
          {account && (
            <Pressable
              onPress={() => router.push(`/accounts/${account.id}`)}
              style={styles.accountChip}
            >
              <Text style={styles.accountChipText}>{account.name}</Text>
            </Pressable>
          )}
        </View>

        {/* Contact methods */}
        {contactMethods.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Contact Info" />
            <View style={styles.sectionContent}>
              {contactMethods.map((m, i) => (
                <React.Fragment key={m.id}>
                  {i > 0 && <Divider />}
                  <ContactMethodRow method={m} />
                </React.Fragment>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <SectionHeader
            title="Notes"
            actionLabel={editingNotes ? 'Save' : 'Edit'}
            onAction={editingNotes ? handleSaveNotes : () => setEditingNotes(true)}
          />
          <View style={styles.sectionContent}>
            {editingNotes ? (
              <TextInput
                value={notesValue}
                onChangeText={setNotesValue}
                multiline
                style={styles.notesInput}
                placeholder="Notes about this contact..."
                placeholderTextColor={colors.form.inputPlaceholder}
                autoFocus
              />
            ) : (
              <Text style={styles.notesText}>
                {contact.notes || <Text style={styles.noNotes}>No notes</Text>}
              </Text>
            )}
          </View>
        </View>

        {/* Events */}
        <View style={styles.section}>
          <SectionHeader
            title="Events"
            actionLabel="Add Event"
            onAction={() => router.push({ pathname: '/events/new', params: { contactId: id } })}
          />
          {linkedEvents.length === 0 ? (
            <EmptyState title="No events" subtitle="Log an event with this contact." />
          ) : (
            <View style={styles.sectionContent}>
              {linkedEvents.map((e, i) => {
                const day = days.find((d) => d.id === e.day_id);
                return (
                  <React.Fragment key={e.id}>
                    {i > 0 && <Divider />}
                    <Pressable
                      style={[styles.eventRow, e.is_cancelled && { opacity: 0.5 }]}
                      onPress={() => router.push(`/events/${e.id}`)}
                    >
                      <View style={styles.eventLeft}>
                        <Badge
                          label={formatEventType(e.type)}
                          variant={e.is_cancelled ? 'cancelled' : 'default'}
                        />
                        <Text style={styles.eventDate}>{day?.date ?? '—'}</Text>
                      </View>
                      <Text style={styles.chevron}>›</Text>
                    </Pressable>
                    {e.notes && (
                      <Text style={styles.eventNotes} numberOfLines={1}>{e.notes}</Text>
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          )}
        </View>

        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteBtnText}>Delete Contact</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { paddingBottom: spacing[12] },
  header: { padding: spacing[4], backgroundColor: colors.bg.surface },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: { width: 52, height: 52, borderRadius: radius.full, backgroundColor: colors.interactive.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: colors.interactive.primaryText, fontSize: typography.size.xl, fontWeight: typography.weight.bold },
  headerInfo: { flex: 1 },
  name: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text.primary },
  title: { fontSize: typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  editBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], backgroundColor: colors.interactive.secondary, borderRadius: radius.md },
  editBtnText: { color: colors.interactive.secondaryText, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  accountChip: { marginTop: spacing[2], alignSelf: 'flex-start', backgroundColor: colors.bg.raised, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full },
  accountChipText: { color: colors.text.link, fontSize: typography.size.sm },
  section: { marginTop: spacing[2] },
  sectionContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
  notesInput: { color: colors.form.inputText, fontSize: typography.size.base, minHeight: 80, textAlignVertical: 'top', backgroundColor: colors.form.inputBg, borderRadius: radius.md, padding: spacing[3], borderWidth: 1, borderColor: colors.form.inputFocusBorder },
  notesText: { color: colors.text.primary, fontSize: typography.size.base, lineHeight: typography.size.base * 1.5 },
  noNotes: { color: colors.text.disabled },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[2] },
  eventLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  eventDate: { fontSize: typography.size.sm, color: colors.text.secondary },
  chevron: { color: colors.text.disabled, fontSize: typography.size.lg },
  eventNotes: { fontSize: typography.size.sm, color: colors.text.secondary, paddingBottom: spacing[2] },
  deleteBtn: { margin: spacing[4], padding: spacing[3], backgroundColor: colors.interactive.destructive, borderRadius: radius.md, alignItems: 'center' },
  deleteBtnText: { color: colors.interactive.destructiveText, fontWeight: typography.weight.semibold },
});
