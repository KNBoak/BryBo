import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { colors, spacing, radius, typography } from '../../theme';
import { useDataStore } from '../../stores/dataStore';
import { generateId } from '../../utils/ids';
import { logInfo, logError } from '../../utils/debug';
import { formatPhone } from '../../utils/validation';
import { Button } from '../../components/ui';
import type { Contact, ContactMethod } from '@brybo/shared';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const TAG = 'ImportContactsModal';

interface DeviceContact {
  id: string;
  firstName: string;
  lastName: string;
  cell: string | null;   // already formatted
  email: string | null;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'denied' }
  | { kind: 'loading' }
  | { kind: 'ready'; rows: DeviceContact[] }
  | { kind: 'error'; message: string }
  | { kind: 'importing' };

function pickPhone(phones: Contacts.PhoneNumber[] | undefined): string | null {
  if (!phones || phones.length === 0) return null;
  // Prefer mobile/cell labels.
  const cell = phones.find((p) => {
    const lbl = (p.label ?? '').toLowerCase();
    return lbl.includes('mobile') || lbl.includes('cell') || lbl === 'iphone';
  });
  const chosen = cell ?? phones.find((p) => !!(p.digits ?? p.number)) ?? phones[0];
  // `digits` is the OS-provided unformatted number; fall back to `number` when
  // the platform doesn't supply digits separately. formatPhone strips the
  // leading "1" country code regardless.
  const raw = chosen.digits ?? chosen.number ?? null;
  return raw ? formatPhone(raw) : null;
}

function pickEmail(emails: Contacts.Email[] | undefined): string | null {
  if (!emails || emails.length === 0) return null;
  return emails[0].email ?? null;
}

function projectContact(c: Contacts.ExistingContact): DeviceContact | null {
  const first = (c.firstName ?? '').trim();
  const last = (c.lastName ?? '').trim();
  if (!first && !last) return null;
  return {
    id: c.id,
    firstName: first,
    lastName: last,
    cell: pickPhone(c.phoneNumbers),
    email: pickEmail(c.emails),
  };
}

export function ImportContactsModal({ visible, onClose }: Props) {
  const activeUserId = useDataStore((s) => s.activeUserId);
  const upsertContact = useDataStore((s) => s.upsertContact);
  const existingContacts = useDataStore((s) => s.contacts);
  const existingMethods = useDataStore((s) => s.contactMethods);

  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Reset on open and request permission.
  useEffect(() => {
    if (!visible) return;
    setSelected(new Set());
    setSearch('');
    setProgress({ done: 0, total: 0 });
    let cancelled = false;
    (async () => {
      try {
        setStatus({ kind: 'requesting' });
        const perm = await Contacts.requestPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          setStatus({ kind: 'denied' });
          return;
        }
        setStatus({ kind: 'loading' });
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.FirstName,
            Contacts.Fields.LastName,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
          ],
        });
        if (cancelled) return;
        const rows = data
          .map(projectContact)
          .filter((r): r is DeviceContact => r !== null)
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
        setStatus({ kind: 'ready', rows });
      } catch (e) {
        logError(TAG, 'load device contacts threw', e);
        if (!cancelled) setStatus({ kind: 'error', message: String(e) });
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  // Skip device contacts that look like ones we already have. Heuristic: same
  // first+last (case-insensitive) under the active profile.
  const alreadyImportedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const c of existingContacts) {
      if (c.user_id !== activeUserId) continue;
      keys.add(`${c.first_name.trim().toLowerCase()}|${c.last_name.trim().toLowerCase()}`);
    }
    return keys;
  }, [existingContacts, activeUserId]);

  const visibleRows = useMemo(() => {
    if (status.kind !== 'ready') return [];
    const q = search.trim().toLowerCase();
    if (!q) return status.rows;
    return status.rows.filter((r) =>
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q),
    );
  }, [status, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (status.kind !== 'ready') return;
    setSelected(new Set(visibleRows.map((r) => r.id)));
  };

  const clearAll = () => setSelected(new Set());

  const handleImport = async () => {
    if (status.kind !== 'ready' || !activeUserId || selected.size === 0) return;
    setStatus({ kind: 'importing' });
    const picked = status.rows.filter((r) => selected.has(r.id));
    setProgress({ done: 0, total: picked.length });
    const now = new Date().toISOString();
    let done = 0;
    try {
      for (const r of picked) {
        const contact: Contact = {
          id: generateId(),
          user_id: activeUserId,
          account_id: null,
          first_name: r.firstName,
          last_name: r.lastName,
          title: null,
          notes: null,
          created_at: now,
          updated_at: now,
        };
        const methods: ContactMethod[] = [];
        if (r.cell) {
          methods.push({
            id: generateId(),
            contact_id: contact.id,
            type: 'cell',
            value: r.cell,
            label: null,
            is_primary: methods.length === 0,
          });
        }
        if (r.email) {
          methods.push({
            id: generateId(),
            contact_id: contact.id,
            type: 'email',
            value: r.email,
            label: null,
            is_primary: methods.length === 0,
          });
        }
        await upsertContact(contact, methods);
        done++;
        setProgress({ done, total: picked.length });
      }
      logInfo(TAG, 'import complete', { count: done });
      onClose();
    } catch (e) {
      logError(TAG, 'import threw', e);
      setStatus({ kind: 'error', message: String(e) });
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Import contacts from phone</Text>

          {status.kind === 'requesting' || status.kind === 'loading' ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.text.link} />
              <Text style={styles.centerText}>
                {status.kind === 'requesting' ? 'Asking for permission…' : 'Loading contacts…'}
              </Text>
            </View>
          ) : status.kind === 'denied' ? (
            <View style={styles.center}>
              <Text style={styles.centerText}>
                Permission denied. Open your device settings and grant Contacts access to BryBo to import.
              </Text>
            </View>
          ) : status.kind === 'error' ? (
            <View style={styles.center}>
              <Text style={[styles.centerText, { color: colors.text.danger }]}>{status.message}</Text>
            </View>
          ) : status.kind === 'importing' ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.text.link} />
              <Text style={styles.centerText}>
                Importing… {progress.done}/{progress.total}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  style={styles.search}
                  placeholder="Search…"
                  placeholderTextColor={colors.form.inputPlaceholder}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.actionsRow}>
                <Pressable style={styles.linkBtn} onPress={selectAll}>
                  <Text style={styles.linkBtnText}>Select all (visible)</Text>
                </Pressable>
                <Pressable style={styles.linkBtn} onPress={clearAll}>
                  <Text style={styles.linkBtnText}>Clear</Text>
                </Pressable>
                <Text style={styles.countText}>{selected.size} selected</Text>
              </View>

              <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
                {visibleRows.length === 0 ? (
                  <Text style={styles.emptyText}>No matching contacts.</Text>
                ) : (
                  visibleRows.map((r) => {
                    const checked = selected.has(r.id);
                    const dupKey = `${r.firstName.trim().toLowerCase()}|${r.lastName.trim().toLowerCase()}`;
                    const dup = alreadyImportedKeys.has(dupKey);
                    const fullName = `${r.firstName} ${r.lastName}`.trim() || '—';
                    return (
                      <Pressable
                        key={r.id}
                        style={[styles.row, checked && styles.rowChecked]}
                        onPress={() => toggle(r.id)}
                      >
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
                        </View>
                        <View style={styles.rowBody}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {fullName}
                            {dup ? <Text style={styles.dupTag}>  · already in your list</Text> : null}
                          </Text>
                          <Text style={styles.rowSub} numberOfLines={1}>
                            {[r.cell, r.email].filter(Boolean).join('  ·  ') || '(no phone or email)'}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </>
          )}

          <View style={styles.footer}>
            <Button label="Close" onPress={onClose} variant="ghost" size="sm" />
            {status.kind === 'ready' && (
              <Button
                label={`Import ${selected.size}`}
                onPress={handleImport}
                variant="primary"
                size="sm"
                disabled={selected.size === 0}
              />
            )}
          </View>
        </Pressable>
      </Pressable>
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
    maxHeight: '90%',
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
  center: {
    padding: spacing[6],
    alignItems: 'center',
    gap: spacing[2],
  },
  centerText: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  searchRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  search: {
    backgroundColor: colors.form.inputBg,
    borderWidth: 0.5,
    borderColor: colors.form.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.form.inputText,
    fontSize: typography.size.sm,
  },
  actionsRow: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  linkBtn: { paddingVertical: 4 },
  linkBtnText: { color: colors.text.link, fontSize: typography.size.xs },
  countText: {
    marginLeft: 'auto',
    color: colors.text.secondary,
    fontSize: typography.size.xs,
  },
  scroll: { maxHeight: 480 },
  emptyText: {
    padding: spacing[5],
    textAlign: 'center',
    fontStyle: 'italic',
    color: colors.text.disabled,
    fontSize: typography.size.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  rowChecked: { backgroundColor: colors.status.todayBg },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.interactive.primary,
    borderColor: colors.interactive.primary,
  },
  checkboxMark: { color: '#fff', fontSize: 14, fontWeight: typography.weight.bold },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowName: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
    fontWeight: typography.weight.medium,
  },
  dupTag: {
    color: colors.text.secondary,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.regular,
  },
  rowSub: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[3],
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
    backgroundColor: colors.bg.surface,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
