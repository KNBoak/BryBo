import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { Button } from '../../components/ui';

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
}

interface Props {
  visible: boolean;
  title: string;
  items: PickerItem[];
  excludeIds?: string[];   // ids already selected — rendered dimmed/disabled
  iconBg?: string;
  iconText?: string;
  emoji?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

export function EntityPickerModal({
  visible,
  title,
  items,
  excludeIds,
  iconBg,
  iconText,
  emoji,
  onPick,
  onClose,
}: Props) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  const excludeSet = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      it.label.toLowerCase().includes(q) ||
      (it.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.searchWrap}>
            <TextInput
              style={styles.search}
              value={search}
              onChangeText={setSearch}
              placeholder="Search…"
              placeholderTextColor={colors.form.inputPlaceholder}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {filtered.length === 0 ? (
              <Text style={styles.empty}>No matches.</Text>
            ) : (
              filtered.map((it) => {
                const used = excludeSet.has(it.id);
                return (
                  <Pressable
                    key={it.id}
                    style={[styles.row, used && styles.rowUsed]}
                    disabled={used}
                    onPress={() => onPick(it.id)}
                  >
                    {emoji ? (
                      <View style={[styles.icon, !!iconBg && { backgroundColor: iconBg }]}>
                        <Text style={[styles.iconText, !!iconText && { color: iconText }]}>
                          {emoji}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.rowBody}>
                      <Text
                        style={[styles.rowLabel, used && styles.rowLabelUsed]}
                        numberOfLines={1}
                      >
                        {it.label}
                      </Text>
                      {it.sublabel ? (
                        <Text style={styles.rowSub} numberOfLines={1}>{it.sublabel}</Text>
                      ) : null}
                    </View>
                    {used ? <Text style={styles.linkedTag}>linked</Text> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button label="Cancel" onPress={onClose} variant="ghost" size="sm" />
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
    padding: spacing[4],
  },
  sheet: {
    backgroundColor: colors.bg.sunken,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  title: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.tight,
    color: colors.text.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  searchWrap: {
    padding: spacing[3],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  search: {
    backgroundColor: colors.form.inputBg,
    borderWidth: 1,
    borderColor: colors.form.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.form.inputText,
    fontSize: typography.size.sm,
  },
  scroll: { maxHeight: 420 },
  empty: {
    padding: spacing[4],
    fontSize: typography.size.sm,
    color: colors.text.disabled,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  rowUsed: { opacity: 0.45 },
  icon: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 13, color: colors.text.primary },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  rowLabelUsed: { color: colors.text.disabled },
  rowSub: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginTop: 1,
  },
  linkedTag: {
    fontSize: typography.size.xs,
    color: colors.text.disabled,
  },
  footer: {
    padding: spacing[3],
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
    backgroundColor: colors.bg.surface,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
