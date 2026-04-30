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
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../theme';
import { Input, TextArea, Button } from '../../components/ui';
import { ContactMethodEditor } from './ContactMethodEditor';
import { useDataStore } from '../../stores/dataStore';
import { fullName } from '@brybo/shared';
import type { Contact, ContactMethod } from '@brybo/shared';

interface Props {
  editId?: string;
  prefillAccountId?: string;
}

export function ContactFormScreen({ editId, prefillAccountId }: Props) {
  const router = useRouter();
  const activeUserId = useDataStore((s) => s.activeUserId)!;
  const contacts = useDataStore((s) => s.contacts);
  const contactMethods = useDataStore((s) => s.contactMethods);
  const accounts = useDataStore((s) => s.accounts);
  const upsertContact = useDataStore((s) => s.upsertContact);

  const existing = editId ? contacts.find((c) => c.id === editId) : undefined;
  const existingMethods = editId ? contactMethods.filter((m) => m.contact_id === editId) : [];

  const [firstName, setFirstName] = useState(existing?.first_name ?? '');
  const [lastName, setLastName] = useState(existing?.last_name ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [accountId, setAccountId] = useState<string | null>(
    existing?.account_id ?? prefillAccountId ?? null,
  );
  const [methods, setMethods] = useState<Omit<ContactMethod, 'contact_id'>[]>(
    existingMethods.map(({ contact_id: _, ...rest }) => rest),
  );
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.toLowerCase();
    return accounts.filter((a) => a.name.toLowerCase().includes(q));
  }, [accounts, accountSearch]);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  const handleSave = async () => {
    const errs: typeof errors = {};
    if (!firstName.trim()) errs.firstName = 'First name is required.';
    if (!lastName.trim()) errs.lastName = 'Last name is required.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    const now = new Date().toISOString();
    const contactId = existing?.id ?? generateId();
    const contact: Contact = {
      id: contactId,
      user_id: activeUserId,
      account_id: accountId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      title: title.trim() || null,
      notes: notes.trim() || null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    const fullMethods: ContactMethod[] = methods.map((m) => ({ ...m, contact_id: contactId }));
    await upsertContact(contact, fullMethods);
    setSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <View style={styles.nameRow}>
            <View style={styles.flex1}>
              <Input label="First Name *" value={firstName} onChangeText={setFirstName} placeholder="First" error={errors.firstName} autoCapitalize="words" />
            </View>
            <View style={styles.flex1}>
              <Input label="Last Name *" value={lastName} onChangeText={setLastName} placeholder="Last" error={errors.lastName} autoCapitalize="words" />
            </View>
          </View>

          <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. VP of Sales" autoCapitalize="words" />

          {/* Account picker */}
          <View>
            <Text style={styles.fieldLabel}>Account</Text>
            <Pressable
              style={styles.accountPicker}
              onPress={() => setShowAccountPicker(true)}
            >
              <Text style={selectedAccount ? styles.accountPickerText : styles.accountPickerPlaceholder}>
                {selectedAccount?.name ?? 'Select account (optional)'}
              </Text>
              {accountId && (
                <Pressable onPress={() => setAccountId(null)}>
                  <Text style={styles.clearBtn}>✕</Text>
                </Pressable>
              )}
            </Pressable>
          </View>

          <ContactMethodEditor methods={methods} onChange={setMethods} />

          <TextArea label="Notes" value={notes} onChangeText={setNotes} placeholder="Notes about this contact..." numberOfLines={3} />
        </View>

        <View style={styles.actions}>
          <Button label="Cancel" onPress={() => router.back()} variant="ghost" />
          <Button label={editId ? 'Save Changes' : 'Create Contact'} onPress={handleSave} loading={saving} />
        </View>
      </ScrollView>

      {/* Account picker modal */}
      <Modal visible={showAccountPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Account</Text>
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
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setAccountId(item.id);
                    setShowAccountPicker(false);
                    setAccountSearch('');
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  {accountId === item.id && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              )}
            />
            <Button label="Close" onPress={() => setShowAccountPicker(false)} variant="ghost" fullWidth />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  form: { gap: spacing[4] },
  nameRow: { flexDirection: 'row', gap: spacing[3] },
  flex1: { flex: 1 },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.form.labelText, marginBottom: spacing[1] },
  accountPicker: { backgroundColor: colors.form.inputBg, borderWidth: 1, borderColor: colors.form.inputBorder, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2] + 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accountPickerText: { color: colors.form.inputText, fontSize: typography.size.base },
  accountPickerPlaceholder: { color: colors.form.inputPlaceholder, fontSize: typography.size.base },
  clearBtn: { color: colors.text.secondary, fontSize: typography.size.base, padding: spacing[1] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[3], marginTop: spacing[4] },
  modalOverlay: { flex: 1, backgroundColor: colors.bg.overlay, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.bg.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[3], maxHeight: '70%' },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text.primary },
  modalSearch: { backgroundColor: colors.form.inputBg, color: colors.form.inputText, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: typography.size.base, borderWidth: 1, borderColor: colors.form.inputBorder },
  modalList: { flexGrow: 0 },
  modalItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing[3], borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.muted },
  modalItemText: { fontSize: typography.size.base, color: colors.text.primary },
  checkmark: { color: colors.interactive.primary, fontSize: typography.size.md },
});
