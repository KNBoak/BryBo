import React, { useState } from 'react';
import { generateId } from '../../utils/ids';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../theme';
import { Input, TextArea, Button } from '../../components/ui';
import { useDataStore } from '../../stores/dataStore';
import type { Account } from '@brybo/shared';

interface Props {
  editId?: string;
}

export function AccountFormScreen({ editId }: Props) {
  const router = useRouter();
  const activeUserId = useDataStore((s) => s.activeUserId)!;
  const accounts = useDataStore((s) => s.accounts);
  const upsertAccount = useDataStore((s) => s.upsertAccount);

  const existing = editId ? accounts.find((a) => a.id === editId) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [state, setState] = useState(existing?.state ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [website, setWebsite] = useState(existing?.website ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [showExtra, setShowExtra] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }
    setError('');
    setSaving(true);
    const now = new Date().toISOString();
    const account: Account = {
      id: existing?.id ?? generateId(),
      user_id: activeUserId,
      name: name.trim(),
      city: city.trim() || null,
      state: state.trim() || null,
      phone: phone.trim() || null,
      website: website.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    await upsertAccount(account);
    setSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          <Input
            label="Account Name *"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Acme Corp"
            error={error}
            autoCapitalize="words"
          />

          <Pressable
            style={styles.extraToggle}
            onPress={() => setShowExtra(!showExtra)}
          >
            <Text style={styles.extraToggleText}>
              {showExtra ? '▾ Hide additional info' : '▸ Add additional info (city, phone, etc.)'}
            </Text>
          </Pressable>

          {showExtra && (
            <View style={styles.extraFields}>
              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <Input label="City" value={city} onChangeText={setCity} placeholder="City" />
                </View>
                <View style={styles.stateField}>
                  <Input label="State" value={state} onChangeText={setState} placeholder="ST" autoCapitalize="characters" />
                </View>
              </View>
              <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 000-0000" keyboardType="phone-pad" />
              <Input label="Website" value={website} onChangeText={setWebsite} placeholder="https://example.com" keyboardType="url" autoCapitalize="none" />
              <Input label="Address" value={address} onChangeText={setAddress} placeholder="Street address" />
              <TextArea label="Notes" value={notes} onChangeText={setNotes} placeholder="Any notes about this account..." />
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button label="Cancel" onPress={() => router.back()} variant="ghost" />
          <Button label={editId ? 'Save Changes' : 'Create Account'} onPress={handleSave} loading={saving} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[12] },
  form: { gap: spacing[4] },
  row2: { flexDirection: 'row', gap: spacing[3] },
  flex1: { flex: 1 },
  stateField: { width: 80 },
  extraToggle: { paddingVertical: spacing[2] },
  extraToggleText: { color: colors.text.link, fontSize: typography.size.base },
  extraFields: { gap: spacing[4] },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[3], marginTop: spacing[4] },
});
