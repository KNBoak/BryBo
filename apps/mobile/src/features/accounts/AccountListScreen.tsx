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
import { Badge, EmptyState, Divider } from '../../components/ui';
import { useAccounts, AccountWithMeta } from './hooks/useAccounts';
import { formatDateShort } from '@brybo/shared';

type Filter = 'all' | 'prospects' | 'customers';

export function AccountListScreen() {
  const router = useRouter();
  const accounts = useAccounts();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    let result = accounts;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.city?.toLowerCase().includes(q) ?? false),
      );
    }
    if (filter === 'prospects') result = result.filter((a) => a.isProspect);
    if (filter === 'customers') result = result.filter((a) => !a.isProspect);
    return result;
  }, [accounts, search, filter]);

  const renderItem = ({ item }: { item: AccountWithMeta }) => (
    <Pressable
      style={styles.row}
      onPress={() => router.push(`/accounts/${item.id}`)}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowTop}>
          <Text style={styles.accountName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.isProspect && <Badge label="Prospect" variant="prospect" />}
        </View>
        <View style={styles.rowMeta}>
          {item.city || item.state ? (
            <Text style={styles.metaText}>
              {[item.city, item.state].filter(Boolean).join(', ')}
            </Text>
          ) : null}
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
            placeholder="Search accounts..."
            placeholderTextColor={colors.form.inputPlaceholder}
          />
        </View>

        <View style={styles.filters}>
          {(['all', 'prospects', 'customers'] as Filter[]).map((f) => (
            <Pressable
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterLabel,
                  filter === f && styles.filterLabelActive,
                ]}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <Divider indent={spacing[4]} />}
          ListEmptyComponent={
            <EmptyState
              title="No accounts found"
              subtitle={search ? 'Try a different search.' : 'Add your first account to get started.'}
              actionLabel={!search ? 'Add Account' : undefined}
              onAction={!search ? () => router.push('/accounts/new') : undefined}
            />
          }
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : undefined}
        />

        <Pressable style={styles.fab} onPress={() => router.push('/accounts/new')}>
          <Text style={styles.fabIcon}>+</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  container: { flex: 1 },
  searchRow: { padding: spacing[4], paddingBottom: spacing[2] },
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
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
    gap: spacing[2],
  },
  filterBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.raised,
  },
  filterBtnActive: { backgroundColor: colors.interactive.primary },
  filterLabel: { fontSize: typography.size.sm, color: colors.text.secondary },
  filterLabelActive: { color: colors.interactive.primaryText, fontWeight: typography.weight.semibold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.bg.canvas,
  },
  rowMain: { flex: 1, gap: spacing[1] },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  accountName: {
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
    flex: 1,
  },
  rowMeta: { flexDirection: 'row', gap: spacing[3] },
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
