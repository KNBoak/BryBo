import React, { useState, useMemo } from 'react';
import { generateId } from '../../utils/ids';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../theme';
import { Input, TextArea, Button, Badge } from '../../components/ui';
import { useDataStore } from '../../stores/dataStore';
import { today, ensureDayExists, shouldShowAmountByDefault, formatEventType } from '@brybo/shared';
import { EVENT_TYPES, type EventTypePrimary } from '@brybo/shared';
import type { Event } from '@brybo/shared';

interface Props {
  editId?: string;
  prefillDate?: string;
  prefillAccountId?: string;
  prefillContactId?: string;
}

export function EventFormScreen({ editId, prefillDate, prefillAccountId, prefillContactId }: Props) {
  const router = useRouter();
  const activeUserId = useDataStore((s) => s.activeUserId)!;
  const events = useDataStore((s) => s.events);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const eventContacts = useDataStore((s) => s.eventContacts);
  const accounts = useDataStore((s) => s.accounts);
  const contacts = useDataStore((s) => s.contacts);
  const days = useDataStore((s) => s.days);
  const upsertEvent = useDataStore((s) => s.upsertEvent);
  const _ingestDay = useDataStore((s) => s._ingestDay);
  const _storage = useDataStore((s) => s._storage)!;

  const existing = editId ? events.find((e) => e.id === editId) : undefined;
  const existingDay = existing ? days.find((d) => d.id === existing.day_id) : undefined;
  const existingAccountIds = editId ? eventAccounts.filter((ea) => ea.event_id === editId).map((ea) => ea.account_id) : [];
  const existingContactIds = editId ? eventContacts.filter((ec) => ec.event_id === editId).map((ec) => ec.contact_id) : [];

  const [date, setDate] = useState(existingDay?.date ?? prefillDate ?? today());
  const [type, setType] = useState<string>(existing?.type ?? 'call');
  const [customType, setCustomType] = useState('');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [amountStr, setAmountStr] = useState(existing?.amount?.toString() ?? '');
  const [showAmount, setShowAmount] = useState(existing?.amount !== null && existing?.amount !== undefined);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(
    prefillAccountId ? [prefillAccountId] : existingAccountIds,
  );
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>(
    prefillContactId ? [prefillContactId] : existingContactIds,
  );
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveType = type === 'custom' ? customType : type;

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q),
    );
  }, [contacts, contactSearch]);

  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));
  const selectedContacts = contacts.filter((c) => selectedContactIds.includes(c.id));

  const handleTypeSelect = (t: string) => {
    setType(t);
    if (t !== 'custom') {
      setShowAmount(shouldShowAmountByDefault(t));
    }
  };

  const handleSave = async () => {
    const finalType = type === 'custom' ? customType.trim() : type;
    if (!finalType) { Alert.alert('Error', 'Please select or enter an event type.'); return; }

    setSaving(true);
    try {
      const day = await ensureDayExists(activeUserId, date, _storage);
      _ingestDay(day);

      const amount = showAmount && amountStr ? parseFloat(amountStr) : null;
      const now = new Date().toISOString();
      const event: Event = {
        id: existing?.id ?? generateId(),
        user_id: activeUserId,
        day_id: day.id,
        type: finalType,
        notes: notes.trim() || null,
        amount: amount && !isNaN(amount) ? amount : null,
        is_cancelled: existing?.is_cancelled ?? false,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };

      await upsertEvent(event, selectedAccountIds, selectedContactIds);
      router.back();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Date */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Date</Text>
          <Input
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            keyboardType="numeric"
            autoCapitalize="none"
          />
        </View>

        {/* Event type chips */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Event Type</Text>
          <View style={styles.typeGrid}>
            {EVENT_TYPES.map((t) => (
              <Pressable
                key={t}
                style={[styles.typeChip, type === t && styles.typeChipActive]}
                onPress={() => handleTypeSelect(t)}
              >
                <Text style={[styles.typeChipLabel, type === t && styles.typeChipLabelActive]}>
                  {formatEventType(t)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.typeChip, type === 'custom' && styles.typeChipActive]}
              onPress={() => handleTypeSelect('custom')}
            >
              <Text style={[styles.typeChipLabel, type === 'custom' && styles.typeChipLabelActive]}>
                Custom
              </Text>
            </Pressable>
          </View>
          {type === 'custom' && (
            <Input
              value={customType}
              onChangeText={setCustomType}
              placeholder="Enter custom type..."
              autoCapitalize="words"
            />
          )}
        </View>

        {/* Notes */}
        <TextArea
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="What happened? Any notes..."
          numberOfLines={3}
        />

        {/* Amount */}
        <View style={styles.fieldGroup}>
          <Pressable
            style={styles.amountToggle}
            onPress={() => setShowAmount(!showAmount)}
          >
            <Text style={styles.amountToggleText}>
              {showAmount ? '▾ Sale amount' : '▸ Add sale amount'}
            </Text>
          </Pressable>
          {showAmount && (
            <Input
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="0.00"
              keyboardType="numeric"
            />
          )}
        </View>

        {/* Linked Accounts */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Accounts</Text>
          {selectedAccounts.length > 0 && (
            <View style={styles.chips}>
              {selectedAccounts.map((a) => (
                <Pressable
                  key={a.id}
                  style={styles.selectedChip}
                  onPress={() => setSelectedAccountIds((ids) => ids.filter((id) => id !== a.id))}
                >
                  <Text style={styles.selectedChipText}>{a.name} ✕</Text>
                </Pressable>
              ))}
            </View>
          )}
          <Button
            label="Link Account"
            onPress={() => setShowAccountPicker(true)}
            variant="secondary"
            size="sm"
          />
        </View>

        {/* Linked Contacts */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Contacts</Text>
          {selectedContacts.length > 0 && (
            <View style={styles.chips}>
              {selectedContacts.map((c) => (
                <Pressable
                  key={c.id}
                  style={styles.selectedChip}
                  onPress={() => setSelectedContactIds((ids) => ids.filter((id) => id !== c.id))}
                >
                  <Text style={styles.selectedChipText}>
                    {c.first_name} {c.last_name} ✕
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
          <Button
            label="Link Contact"
            onPress={() => setShowContactPicker(true)}
            variant="secondary"
            size="sm"
          />
        </View>

        <View style={styles.actions}>
          <Button label="Cancel" onPress={() => router.back()} variant="ghost" />
          <Button label={editId ? 'Save Changes' : 'Log Event'} onPress={handleSave} loading={saving} />
        </View>
      </ScrollView>

      {/* Account picker modal */}
      <Modal visible={showAccountPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Link Account</Text>
            <TextInput
              value={accountSearch}
              onChangeText={setAccountSearch}
              placeholder="Search..."
              placeholderTextColor={colors.form.inputPlaceholder}
              style={styles.modalSearch}
            />
            <FlatList
              data={filteredAccounts}
              keyExtractor={(a) => a.id}
              style={styles.modalList}
              renderItem={({ item }) => {
                const selected = selectedAccountIds.includes(item.id);
                return (
                  <Pressable
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedAccountIds((ids) =>
                        selected ? ids.filter((id) => id !== item.id) : [...ids, item.id],
                      );
                    }}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                );
              }}
            />
            <Button label="Done" onPress={() => { setShowAccountPicker(false); setAccountSearch(''); }} fullWidth />
          </View>
        </View>
      </Modal>

      {/* Contact picker modal */}
      <Modal visible={showContactPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Link Contact</Text>
            <TextInput
              value={contactSearch}
              onChangeText={setContactSearch}
              placeholder="Search..."
              placeholderTextColor={colors.form.inputPlaceholder}
              style={styles.modalSearch}
            />
            <FlatList
              data={filteredContacts}
              keyExtractor={(c) => c.id}
              style={styles.modalList}
              renderItem={({ item }) => {
                const selected = selectedContactIds.includes(item.id);
                return (
                  <Pressable
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedContactIds((ids) =>
                        selected ? ids.filter((id) => id !== item.id) : [...ids, item.id],
                      );
                    }}
                  >
                    <Text style={styles.modalItemText}>
                      {item.first_name} {item.last_name}
                    </Text>
                    {selected && <Text style={styles.checkmark}>✓</Text>}
                  </Pressable>
                );
              }}
            />
            <Button label="Done" onPress={() => { setShowContactPicker(false); setContactSearch(''); }} fullWidth />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing[4], gap: spacing[5], paddingBottom: spacing[12] },
  fieldGroup: { gap: spacing[2] },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.form.labelText },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  typeChip: { paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 2, borderRadius: radius.full, backgroundColor: colors.bg.raised },
  typeChipActive: { backgroundColor: colors.interactive.primary },
  typeChipLabel: { fontSize: typography.size.sm, color: colors.text.secondary },
  typeChipLabelActive: { color: colors.interactive.primaryText, fontWeight: typography.weight.semibold },
  amountToggle: { paddingVertical: spacing[1] },
  amountToggleText: { color: colors.text.link, fontSize: typography.size.base },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  selectedChip: { backgroundColor: colors.interactive.secondary, paddingHorizontal: spacing[3], paddingVertical: spacing[1], borderRadius: radius.full },
  selectedChipText: { color: colors.interactive.secondaryText, fontSize: typography.size.sm },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[3], marginTop: spacing[2] },
  modalOverlay: { flex: 1, backgroundColor: colors.bg.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[3], maxHeight: '70%' },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary },
  modalSearch: { backgroundColor: colors.form.inputBg, color: colors.form.inputText, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: typography.size.base, borderWidth: 1, borderColor: colors.form.inputBorder },
  modalList: { flexGrow: 0 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.muted },
  modalItemText: { fontSize: typography.size.base, color: colors.text.primary },
  checkmark: { color: colors.interactive.primary, fontSize: typography.size.md },
});
