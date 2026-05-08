import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDataStore } from '../../stores/dataStore';
import { colors, spacing, radius, typography } from '../../theme';
import { Button, Input, Card, EmptyState } from '../../components/ui';
import { logInfo, logWarn, logError } from '../../utils/debug';
import { generateId } from '../../utils/ids';
import { nextProfileColor, colorForUser } from '../../utils/profileColors';
import type { User } from '@brybo/shared';

const TAG = 'ProfileSelect';

export function ProfileSelectScreen() {
  const users = useDataStore((s) => s.users);
  const upsertUser = useDataStore((s) => s.upsertUser);
  const setActiveUser = useDataStore((s) => s.setActiveUser);
  const deleteUser = useDataStore((s) => s.deleteUser);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      logWarn(TAG, 'handleCreate: empty name, aborting');
      return;
    }
    logInfo(TAG, 'handleCreate start', { name: trimmed });
    setSaving(true);
    try {
      const now = new Date().toISOString();
      logInfo(TAG, 'Generating ID...');
      const id = generateId();
      logInfo(TAG, 'ID generated', { id });
      const user: User = { id, name: trimmed, color: nextProfileColor(users.length), created_at: now };
      logInfo(TAG, 'Calling upsertUser...');
      await upsertUser(user);
      logInfo(TAG, 'upsertUser done, calling setActiveUser...');
      await setActiveUser(user.id);
      logInfo(TAG, 'setActiveUser done — navigation should trigger');
      setShowNew(false);
      setName('');
    } catch (e) {
      logError(TAG, 'handleCreate threw', e);
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = async (user: User) => {
    logInfo(TAG, 'handleSelect', { id: user.id, name: user.name });
    try {
      await setActiveUser(user.id);
      logInfo(TAG, 'handleSelect: setActiveUser done');
    } catch (e) {
      logError(TAG, 'handleSelect threw', e);
    }
  };

  const handleDelete = (user: User) => {
    Alert.alert(
      `Delete profile "${user.name}"?`,
      'This will permanently remove the profile and all of its accounts, contacts, and events. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(user.id);
              logInfo(TAG, 'profile deleted', { id: user.id });
            } catch (e) {
              logError(TAG, 'deleteUser threw', e);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>BryBo</Text>
          <Text style={styles.subtitle}>Who's using the app?</Text>
        </View>

        {users.length === 0 ? (
          <EmptyState
            title="No profiles yet"
            subtitle="Create your profile to get started."
          />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => (
              <Card onPress={() => handleSelect(item)} style={styles.profileCard}>
                <View style={styles.profileRow}>
                  <View style={[styles.avatar, { backgroundColor: colorForUser(item, index) }]}>
                    <Text style={styles.avatarText}>{(item.name[0] ?? '?').toUpperCase()}</Text>
                  </View>
                  <Text style={styles.profileName}>{item.name}</Text>
                  <Pressable
                    style={styles.deleteBtn}
                    hitSlop={10}
                    onPress={() => handleDelete(item)}
                  >
                    <Text style={styles.deleteBtnText}>×</Text>
                  </Pressable>
                </View>
              </Card>
            )}
            ItemSeparatorComponent={() => <View style={{ height: spacing[2] }} />}
          />
        )}

        <View style={styles.footer}>
          <Button
            label="New Profile"
            onPress={() => setShowNew(true)}
            variant="secondary"
            fullWidth
          />
        </View>
      </View>

      <Modal visible={showNew} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Create Profile</Text>
            <Input
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Bryan"
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <Button
                label="Cancel"
                onPress={() => { setShowNew(false); setName(''); }}
                variant="ghost"
              />
              <Button
                label="Create"
                onPress={handleCreate}
                loading={saving}
                disabled={!name.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.canvas },
  container: { flex: 1, padding: spacing[6] },
  header: { alignItems: 'center', marginBottom: spacing[8] },
  title: {
    fontSize: typography.size['3xl'],
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    marginTop: spacing[2],
  },
  list: { paddingBottom: spacing[4] },
  profileCard: { paddingVertical: spacing[4] },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.interactive.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.interactive.primaryText,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  profileName: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 0.5,
    borderColor: colors.border.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: colors.text.danger,
    fontSize: 20,
    lineHeight: 20,
  },
  footer: { marginTop: spacing[6] },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.bg.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing[6],
    gap: spacing[4],
  },
  modalTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text.primary,
    letterSpacing: typography.letterSpacing.tight,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing[3],
    marginTop: spacing[2],
  },
});
