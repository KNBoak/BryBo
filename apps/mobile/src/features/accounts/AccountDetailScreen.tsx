import React, { useState } from 'react';
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
import { Badge, SectionHeader, Divider, EmptyState } from '../../components/ui';
import { useAccount } from './hooks/useAccounts';
import { useDataStore } from '../../stores/dataStore';
import { formatCurrency, formatEventType, getEventDayDate } from '@brybo/shared';

type Tab = 'info' | 'contacts' | 'events' | 'purchases';

interface Props {
  id: string;
}

export function AccountDetailScreen({ id }: Props) {
  const router = useRouter();
  const account = useAccount(id);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  const contacts = useDataStore((s) => s.contacts.filter((c) => c.account_id === id));
  const eventAccounts = useDataStore((s) => s.eventAccounts.filter((ea) => ea.account_id === id));
  const events = useDataStore((s) => s.events);
  const days = useDataStore((s) => s.days);
  const deleteAccount = useDataStore((s) => s.deleteAccount);

  if (!account) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState title="Account not found" />
      </SafeAreaView>
    );
  }

  const linkedEventIds = new Set(eventAccounts.map((ea) => ea.event_id));
  const linkedEvents = events
    .filter((e) => linkedEventIds.has(e.id))
    .sort((a, b) => {
      const da = getEventDayDate(a, days) ?? '';
      const db = getEventDayDate(b, days) ?? '';
      return db.localeCompare(da);
    });
  const saleEvents = linkedEvents.filter((e) => !e.is_cancelled && e.amount !== null && e.amount > 0);
  const totalSpend = saleEvents.reduce((s, e) => s + (e.amount ?? 0), 0);

  const handleDelete = () => {
    Alert.alert('Delete Account', `Delete "${account.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteAccount(id);
          router.back();
        },
      },
    ]);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'contacts', label: `Contacts (${contacts.length})` },
    { key: 'events', label: `Events (${linkedEvents.length})` },
    { key: 'purchases', label: 'Purchases' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.name}>{account.name}</Text>
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push(`/accounts/${id}/edit`)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.headerMeta}>
            {account.isProspect ? (
              <Badge label="Prospect" variant="prospect" />
            ) : (
              <Badge label="Customer" variant="customer" />
            )}
            {(account.city || account.state) && (
              <Text style={styles.metaText}>
                {[account.city, account.state].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'info' && (
          <View style={styles.section}>
            {account.phone && <InfoRow label="Phone" value={account.phone} />}
            {account.website && <InfoRow label="Website" value={account.website} />}
            {account.address && <InfoRow label="Address" value={account.address} />}
            {account.notes && (
              <View style={styles.notesBlock}>
                <Text style={styles.notesLabel}>Notes</Text>
                <Text style={styles.notesText}>{account.notes}</Text>
              </View>
            )}
            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>Delete Account</Text>
            </Pressable>
          </View>
        )}

        {activeTab === 'contacts' && (
          <View style={styles.section}>
            <SectionHeader
              title="Contacts"
              actionLabel="Add Contact"
              onAction={() => router.push({ pathname: '/contacts/new', params: { accountId: id } })}
            />
            {contacts.length === 0 ? (
              <EmptyState title="No contacts" subtitle="Add a contact for this account." />
            ) : (
              contacts.map((c, i) => (
                <React.Fragment key={c.id}>
                  {i > 0 && <Divider indent={spacing[4]} />}
                  <Pressable
                    style={styles.contactRow}
                    onPress={() => router.push(`/contacts/${c.id}`)}
                  >
                    <View>
                      <Text style={styles.contactName}>
                        {c.first_name} {c.last_name}
                      </Text>
                      {c.title && <Text style={styles.contactTitle}>{c.title}</Text>}
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                </React.Fragment>
              ))
            )}
          </View>
        )}

        {activeTab === 'events' && (
          <View style={styles.section}>
            <SectionHeader
              title="Events"
              actionLabel="Add Event"
              onAction={() => router.push({ pathname: '/events/new', params: { accountId: id } })}
            />
            {linkedEvents.length === 0 ? (
              <EmptyState title="No events" subtitle="Log an event for this account." />
            ) : (
              linkedEvents.map((e, i) => {
                const day = days.find((d) => d.id === e.day_id);
                return (
                  <React.Fragment key={e.id}>
                    {i > 0 && <Divider indent={spacing[4]} />}
                    <Pressable
                      style={[styles.eventRow, e.is_cancelled && styles.eventCancelled]}
                      onPress={() => router.push(`/events/${e.id}`)}
                    >
                      <View style={styles.eventLeft}>
                        <Badge
                          label={formatEventType(e.type)}
                          variant={e.is_cancelled ? 'cancelled' : e.amount ? 'sale' : 'default'}
                        />
                        {day && <Text style={styles.eventDate}>{day.date}</Text>}
                      </View>
                      <View style={styles.eventRight}>
                        {e.amount !== null && (
                          <Text style={styles.eventAmount}>{formatCurrency(e.amount)}</Text>
                        )}
                        <Text style={styles.chevron}>›</Text>
                      </View>
                    </Pressable>
                    {e.notes && <Text style={styles.eventNotes} numberOfLines={1}>{e.notes}</Text>}
                  </React.Fragment>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'purchases' && (
          <View style={styles.section}>
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Spend</Text>
              <Text style={styles.totalAmount}>{formatCurrency(totalSpend)}</Text>
            </View>
            {saleEvents.length === 0 ? (
              <EmptyState title="No sales yet" subtitle="Log a sale event to track revenue." />
            ) : (
              saleEvents.map((e, i) => {
                const day = days.find((d) => d.id === e.day_id);
                return (
                  <React.Fragment key={e.id}>
                    {i > 0 && <Divider indent={spacing[4]} />}
                    <Pressable
                      style={styles.saleRow}
                      onPress={() => router.push(`/events/${e.id}`)}
                    >
                      <Text style={styles.saleDate}>{day?.date ?? '—'}</Text>
                      <Text style={styles.saleAmount}>{formatCurrency(e.amount ?? 0)}</Text>
                    </Pressable>
                  </React.Fragment>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  scroll: { flex: 1 },
  content: { paddingBottom: spacing[12] },
  header: {
    padding: spacing[4],
    paddingBottom: spacing[3],
    backgroundColor: colors.bg.surface,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.text.primary, flex: 1 },
  headerActions: { flexDirection: 'row', gap: spacing[2] },
  editBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[1], backgroundColor: colors.interactive.secondary, borderRadius: radius.md },
  editBtnText: { color: colors.interactive.secondaryText, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  metaText: { fontSize: typography.size.sm, color: colors.text.secondary },
  tabs: { flexDirection: 'row', backgroundColor: colors.bg.surface, borderBottomWidth: 1, borderBottomColor: colors.tab.border },
  tab: { flex: 1, paddingVertical: spacing[3], alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.tab.indicator },
  tabLabel: { fontSize: typography.size.xs, color: colors.tab.inactiveText, fontWeight: typography.weight.medium },
  tabLabelActive: { color: colors.tab.activeText, fontWeight: typography.weight.semibold },
  section: { paddingTop: spacing[2] },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.muted },
  infoLabel: { fontSize: typography.size.base, color: colors.text.secondary },
  infoValue: { fontSize: typography.size.base, color: colors.text.primary, flex: 1, textAlign: 'right' },
  notesBlock: { padding: spacing[4] },
  notesLabel: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing[1] },
  notesText: { fontSize: typography.size.base, color: colors.text.primary, lineHeight: typography.size.base * 1.5 },
  deleteBtn: { margin: spacing[4], padding: spacing[3], backgroundColor: colors.interactive.destructive, borderRadius: radius.md, alignItems: 'center' },
  deleteBtnText: { color: colors.interactive.destructiveText, fontWeight: typography.weight.semibold },
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  contactName: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text.primary },
  contactTitle: { fontSize: typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  chevron: { color: colors.text.disabled, fontSize: typography.size.lg },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  eventCancelled: { opacity: 0.5 },
  eventLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  eventDate: { fontSize: typography.size.sm, color: colors.text.secondary },
  eventRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  eventAmount: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.status.saleText },
  eventNotes: { paddingHorizontal: spacing[4], paddingBottom: spacing[2], fontSize: typography.size.sm, color: colors.text.secondary },
  totalCard: { margin: spacing[4], padding: spacing[4], backgroundColor: colors.status.saleBg, borderRadius: radius.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: typography.size.md, color: colors.status.saleText },
  totalAmount: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.status.saleText },
  saleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  saleDate: { fontSize: typography.size.base, color: colors.text.secondary },
  saleAmount: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text.primary },
});
