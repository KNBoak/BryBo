import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { Input } from '../../components/ui';
import { generateId } from '../../utils/ids';
import type { ContactMethod, ContactMethodType } from '@brybo/shared';

interface ContactMethodEditor {
  methods: Omit<ContactMethod, 'contact_id'>[];
  onChange: (methods: Omit<ContactMethod, 'contact_id'>[]) => void;
}

const TYPE_OPTIONS: ContactMethodType[] = ['cell', 'email', 'work', 'home', 'other'];

export function ContactMethodEditor({ methods, onChange }: ContactMethodEditor) {
  const addMethod = () => {
    onChange([
      ...methods,
      { id: generateId(), type: 'cell', value: '', label: null, is_primary: methods.length === 0 },
    ]);
  };

  const updateMethod = (id: string, updates: Partial<Omit<ContactMethod, 'contact_id'>>) => {
    onChange(methods.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  };

  const removeMethod = (id: string) => {
    const remaining = methods.filter((m) => m.id !== id);
    if (remaining.length > 0 && !remaining.some((m) => m.is_primary)) {
      remaining[0] = { ...remaining[0], is_primary: true };
    }
    onChange(remaining);
  };

  const setPrimary = (id: string) => {
    onChange(methods.map((m) => ({ ...m, is_primary: m.id === id })));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Contact Methods</Text>
      {methods.map((m) => (
        <View key={m.id} style={styles.methodRow}>
          <View style={styles.typeRow}>
            {TYPE_OPTIONS.map((t) => (
              <Pressable
                key={t}
                style={[styles.typeChip, m.type === t && styles.typeChipActive]}
                onPress={() => updateMethod(m.id, { type: t })}
              >
                <Text style={[styles.typeChipLabel, m.type === t && styles.typeChipLabelActive]}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
          <Input
            value={m.value}
            onChangeText={(v) => updateMethod(m.id, { value: v })}
            placeholder={m.type === 'email' ? 'email@example.com' : '(555) 000-0000'}
            keyboardType={m.type === 'email' ? 'email-address' : 'phone-pad'}
            autoCapitalize="none"
          />
          <View style={styles.methodActions}>
            <Pressable
              style={[styles.primaryBtn, m.is_primary && styles.primaryBtnActive]}
              onPress={() => setPrimary(m.id)}
            >
              <Text style={[styles.primaryBtnText, m.is_primary && styles.primaryBtnTextActive]}>
                {m.is_primary ? '★ Primary' : '☆ Set Primary'}
              </Text>
            </Pressable>
            <Pressable onPress={() => removeMethod(m.id)}>
              <Text style={styles.removeBtn}>Remove</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addMethod}>
        <Text style={styles.addBtnText}>+ Add Contact Method</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[3] },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.form.labelText },
  methodRow: { gap: spacing[2], padding: spacing[3], backgroundColor: colors.bg.surface, borderRadius: radius.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  typeChip: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.full, backgroundColor: colors.bg.raised },
  typeChipActive: { backgroundColor: colors.interactive.primary },
  typeChipLabel: { fontSize: typography.size.xs, color: colors.text.secondary },
  typeChipLabelActive: { color: colors.interactive.primaryText, fontWeight: typography.weight.semibold },
  methodActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  primaryBtn: { paddingHorizontal: spacing[2], paddingVertical: spacing[1], borderRadius: radius.sm },
  primaryBtnActive: { backgroundColor: colors.status.todayBg },
  primaryBtnText: { fontSize: typography.size.xs, color: colors.text.secondary },
  primaryBtnTextActive: { color: colors.status.todayText, fontWeight: typography.weight.semibold },
  removeBtn: { fontSize: typography.size.sm, color: colors.text.danger },
  addBtn: { paddingVertical: spacing[2] },
  addBtnText: { color: colors.text.link, fontSize: typography.size.base },
});
