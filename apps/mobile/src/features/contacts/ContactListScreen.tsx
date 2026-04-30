import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radius, typography } from '../../theme';
import { EmptyState, Divider } from '../../components/ui';
import { useContacts, ContactWithMeta } from './hooks/useContacts';
import { fullName, formatDateShort } from '@brybo/shared';
import { useDataStore } from '../../stores/dataStore';

export function ContactListScreen() {
  const router = useRouter();
  const contacts = useContacts();
  const accounts = useDataStore((s) => s.accounts);
  const [search, setSearch] = useState('');
  const [filterAccountId, setFilterAccountId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = contacts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          fullName(c.first_name, c.last_name).toLowerCase().includes(q) ||
          (c.accountName?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filterAccountId) {
      result = result.filter((c) => c.account_id === filterAccountId);
    }
    return result;
  }, [contacts, search, filterAccountId]);

  const renderItem = ({ item }: { item: ContactWithMeta }) => (
    <Pressable style={styles.row} onPress={() => router.push(`/contacts/${item.id}`)}>
      <View style={styles.rowMain}>
        <Text style={styles.name}>{fullName(item.first_name, item.last_name)}</Text>
        <View style={styles.meta}>
          {item.title && <Text style={styles.metaText}>{item.title}</Text>}
          {item.accountName && (
            <Text style={styles.metaText}>{item.accountName}</Text>
          )}
          {item.lastInteractionDate && (
            <Text style={styles.metaText}>
              Last: {formatDateShort(item.lastInteractionDate)}
            </Text>
          )}
        </View>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Search contacts..."
            placeholderTextColor={colors.form.inputPlaceholder}
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider indent={spacing[4]} />}
          ListEmptyComponent={
            <EmptyState
              title="No contacts found"
              subtitle={search ? 'Try a different search.' : 'Add your first contact.'}
              actionLabel={!search ? 'Add Contact' : undefined}
              onAction={!search ? () => router.push('/contacts/new') : undefined}
            />
          }
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : undefined}
        />

        <Pressable style={styles.fab} onPress={() => router.push('/contacts/new')}>
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  container: { flex: 1 },
  searchRow: { padding: spacing[4], paddingBottom: spacing[3] },
  search: {
    backgroundColor: colors.form.inputBg,
    color: colors.form.inputText,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    fontSize: typography.size.base,
    borderWidth: 1,
    borderColor: colors.form.inputBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  rowMain: { flex: 1, gap: spacing[1] },
  name: { fontSize: typography.size.base, fontWeight: typography.weight.semibold, color: colors.text.primary },
  meta: { flexDirection: 'row', gap: spacing[3], flexWrap: 'wrap' },
  metaText: { fontSize: typography.size.sm, color: colors.text.secondary },
  chevron: { color: colors.text.disabled, fontSize: typography.size.lg, marginLeft: spacing[2] },
  fab: {
    position: 'absolute',
    right: spacing[5],
    bottom: spacing[6],
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.interactive.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  fabIcon: { color: colors.interactive.primaryText, fontSize: 28, lineHeight: 32 },
});
