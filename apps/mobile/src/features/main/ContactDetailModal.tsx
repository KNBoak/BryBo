import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, Linking, Alert } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { useDataStore } from '../../stores/dataStore';
import { generateId } from '../../utils/ids';
import { logError } from '../../utils/debug';
import { formatPhone, isValidPhone, isValidEmail, isPhoneKind } from '../../utils/validation';
import { Button } from '../../components/ui';
import type { Contact, ContactMethod, ContactMethodType } from '@brybo/shared';
import { today as todayIso } from '@brybo/shared';

interface Props {
  visible: boolean;
  contactId: string | null; // null = new
  linkToAccountId?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
  onOpenAccount?: (id: string) => void;
  onOpenDay?: (dateIso: string) => void;
}

const TAG = 'ContactDetailModal';

const METHOD_TYPES: ContactMethodType[] = ['cell', 'email', 'work', 'home', 'other'];

const TYPE_LABEL: Record<ContactMethodType, string> = {
  cell: '📱 Cell',
  email: '✉️ Email',
  work: '🏢 Work',
  home: '🏠 Home',
  other: '· Other',
};

interface SavedMethod {
  id: string;
  type: ContactMethodType;
  value: string;
}

interface AddDraft {
  type: ContactMethodType;
  value: string;
}

const EMPTY_ADD: AddDraft = { type: 'cell', value: '' };

const EMPTY_DRAFT = {
  first_name: '',
  last_name: '',
  // Preserved-but-not-edited fields. Existing data carries through; UI doesn't expose them.
  title: '',
  account_id: null as string | null,
  notes: '',
};

export function ContactDetailModal({ visible, contactId, linkToAccountId, onClose, onSaved, onOpenAccount, onOpenDay }: Props) {
  const contacts = useDataStore((s) => s.contacts);
  const contactMethods = useDataStore((s) => s.contactMethods);
  const accounts = useDataStore((s) => s.accounts);
  const events = useDataStore((s) => s.events);
  const eventContacts = useDataStore((s) => s.eventContacts);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const days = useDataStore((s) => s.days);
  const activeUserId = useDataStore((s) => s.activeUserId);
  const upsertContact = useDataStore((s) => s.upsertContact);
  const deleteContact = useDataStore((s) => s.deleteContact);

  // localId tracks the active record so the modal can stay open after a "new"
  // save without resetting itself.
  const [localId, setLocalId] = useState<string | null>(contactId);
  useEffect(() => { if (visible) setLocalId(contactId); }, [visible, contactId]);
  const isNew = localId == null;
  const existing = !isNew ? contacts.find((c) => c.id === localId) ?? null : null;

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [add, setAdd] = useState<AddDraft | null>(null);
  const [addTypePickerOpen, setAddTypePickerOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAdd(null);
    setAddTypePickerOpen(false);
    setAccountPickerOpen(false);
    if (isNew) {
      setDraft({ ...EMPTY_DRAFT, account_id: linkToAccountId ?? null });
      setMethods([]);
    } else if (existing) {
      setDraft({
        first_name: existing.first_name,
        last_name: existing.last_name,
        title: existing.title ?? '',
        account_id: existing.account_id,
        notes: existing.notes ?? '',
      });
      setMethods(
        contactMethods
          .filter((m) => m.contact_id === existing.id)
          .map((m) => ({ id: m.id, type: m.type, value: m.value })),
      );
    }
  }, [visible, isNew, existing?.id, linkToAccountId]);

  // Snapshot of the persisted state, for dirty detection.
  const expectedDraft = useMemo(() => {
    if (existing) return {
      first_name: existing.first_name,
      last_name: existing.last_name,
      title: existing.title ?? '',
      account_id: existing.account_id,
      notes: existing.notes ?? '',
    };
    return { ...EMPTY_DRAFT, account_id: linkToAccountId ?? null };
  }, [existing, linkToAccountId]);

  const expectedMethods = useMemo(() => {
    if (!existing) return [];
    return contactMethods
      .filter((m) => m.contact_id === existing.id)
      .map((m) => ({ id: m.id, type: m.type, value: m.value }));
  }, [existing, contactMethods]);

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(expectedDraft) ||
    JSON.stringify(methods) !== JSON.stringify(expectedMethods);

  function addDraftError(): string | null {
    if (!add) return null;
    const v = add.value.trim();
    if (v.length === 0) return 'Enter a value';
    if (add.type === 'email') return isValidEmail(v) ? null : 'Invalid email';
    if (isPhoneKind(add.type)) return isValidPhone(v) ? null : 'Use ###-###-####';
    return null;
  }

  const addError = addDraftError();
  const canSave =
    !!activeUserId &&
    (draft.first_name.trim().length > 0 || draft.last_name.trim().length > 0) &&
    dirty;

  const handleSave = async () => {
    if (!canSave || !activeUserId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const contact: Contact = {
        id: existing?.id ?? generateId(),
        user_id: activeUserId,
        account_id: draft.account_id,
        first_name: draft.first_name.trim(),
        last_name: draft.last_name.trim(),
        title: draft.title.trim() || null,
        notes: draft.notes.trim() || null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      const cleanMethods: ContactMethod[] = methods.map((m, i) => ({
        id: m.id,
        contact_id: contact.id,
        type: m.type,
        value: m.value,
        label: null,
        is_primary: i === 0,
      }));
      await upsertContact(contact, cleanMethods);
      // If parent supplied onSaved (e.g. select-on-save / return-to-account),
      // honor that nav. Otherwise stay open and bind to the new id.
      if (onSaved) onSaved(contact.id);
      else if (isNew) setLocalId(contact.id);
    } catch (e) {
      logError(TAG, 'handleSave threw', e);
    } finally {
      setSaving(false);
    }
  };

  const confirmAndDelete = () => {
    if (!existing) return;
    const name = `${existing.first_name} ${existing.last_name}`.trim() || 'this contact';
    Alert.alert(
      `Delete ${name}?`,
      'This removes the contact and unlinks them from any events. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContact(existing.id);
              onClose();
            } catch (e) {
              logError(TAG, 'handleDelete threw', e);
            }
          },
        },
      ],
    );
  };

  const handleClose = () => {
    if (!dirty) { onClose(); return; }
    Alert.alert(
      'Discard changes?',
      'You have unsaved changes that will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ],
    );
  };

  const startAdd = () => {
    setAdd(EMPTY_ADD);
    setAddTypePickerOpen(false);
  };

  const cancelAdd = () => {
    setAdd(null);
    setAddTypePickerOpen(false);
  };

  const setAddType = (t: ContactMethodType) => {
    if (!add) return;
    // Re-format the value when switching to a phone type.
    const next = { ...add, type: t };
    if (isPhoneKind(t) && next.value) next.value = formatPhone(next.value);
    setAdd(next);
    setAddTypePickerOpen(false);
  };

  const setAddValue = (v: string) => {
    if (!add) return;
    setAdd({ ...add, value: isPhoneKind(add.type) ? formatPhone(v) : v });
  };

  const confirmAdd = () => {
    if (!add || addError) return;
    setMethods((prev) => [
      ...prev,
      { id: generateId(), type: add.type, value: add.value.trim() },
    ]);
    setAdd(null);
    setAddTypePickerOpen(false);
  };

  const removeMethod = (id: string) => {
    setMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const fullDisplayName = `${draft.first_name} ${draft.last_name}`.trim() || 'Contact';

  const linkedAccount = draft.account_id
    ? accounts.find((a) => a.id === draft.account_id) ?? null
    : null;
  const userAccounts = accounts.filter((a) => a.user_id === activeUserId);

  // Events linked to this contact, split into upcoming (today + future) and past.
  const { upcomingEvents, pastEvents } = useMemo(() => {
    if (!existing) return { upcomingEvents: [], pastEvents: [] };
    const myEventIds = new Set(
      eventContacts.filter((ec) => ec.contact_id === existing.id).map((ec) => ec.event_id),
    );
    const dayDateById = new Map(days.map((d) => [d.id, d.date]));
    const accountsByEvent = new Map<string, string[]>();
    for (const ea of eventAccounts) {
      if (!myEventIds.has(ea.event_id)) continue;
      const arr = accountsByEvent.get(ea.event_id) ?? [];
      arr.push(ea.account_id);
      accountsByEvent.set(ea.event_id, arr);
    }
    const projected = events
      .filter((e) => myEventIds.has(e.id) && !e.is_cancelled)
      .map((e) => ({
        id: e.id,
        date: dayDateById.get(e.day_id) ?? '',
        notes: e.notes ?? '',
        amount: e.amount,
        accountNames: (accountsByEvent.get(e.id) ?? [])
          .map((aid) => accounts.find((a) => a.id === aid)?.name)
          .filter((n): n is string => !!n),
      }));
    const todayStr = todayIso();
    const upcoming = projected
      .filter((e) => e.date && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    const past = projected
      .filter((e) => !e.date || e.date < todayStr)
      .sort((a, b) => b.date.localeCompare(a.date));
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [existing, events, eventContacts, eventAccounts, accounts, days]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{isNew ? 'New contact' : fullDisplayName}</Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Field label="First name" value={draft.first_name} onChange={(v) => setDraft({ ...draft, first_name: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Last name" value={draft.last_name} onChange={(v) => setDraft({ ...draft, last_name: v })} />
              </View>
            </View>

            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Linked account</Text>
              {linkedAccount ? (
                <Pressable
                  style={styles.savedRow}
                  onPress={() => onOpenAccount?.(linkedAccount.id)}
                >
                  <Text style={styles.savedType}>🏢</Text>
                  <View style={styles.savedValueWrap}>
                    <Text style={styles.savedValue} numberOfLines={1}>{linkedAccount.name}</Text>
                  </View>
                  <Pressable
                    style={styles.removeBtn}
                    hitSlop={8}
                    onPress={(e) => { e.stopPropagation(); setDraft({ ...draft, account_id: null }); }}
                  >
                    <Text style={styles.removeBtnText}>×</Text>
                  </Pressable>
                </Pressable>
              ) : accountPickerOpen ? (
                <View style={styles.typePicker}>
                  {userAccounts.length === 0 ? (
                    <View style={styles.typePickerItem}>
                      <Text style={styles.typePickerText}>No accounts yet.</Text>
                    </View>
                  ) : (
                    userAccounts.map((a) => (
                      <Pressable
                        key={a.id}
                        style={styles.typePickerItem}
                        onPress={() => {
                          setDraft({ ...draft, account_id: a.id });
                          setAccountPickerOpen(false);
                        }}
                      >
                        <Text style={styles.typePickerText}>🏢  {a.name}</Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable
                    style={[styles.typePickerItem, { backgroundColor: colors.bg.surface }]}
                    onPress={() => setAccountPickerOpen(false)}
                  >
                    <Text style={[styles.typePickerText, { color: colors.text.secondary }]}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.addMethodBtn} onPress={() => setAccountPickerOpen(true)}>
                  <Text style={styles.addMethodBtnText}>+ Link an account</Text>
                </Pressable>
              )}
            </View>

            <View style={fieldStyles.wrap}>
              <Text style={fieldStyles.label}>Contact methods</Text>

              {methods.map((m) => {
                const isEmail = m.type === 'email';
                const isPhone = isPhoneKind(m.type);
                const launchUrl = isEmail
                  ? `mailto:${m.value.trim()}`
                  : isPhone
                  ? `tel:${m.value.replace(/\D/g, '')}`
                  : null;
                return (
                  <View key={m.id} style={styles.savedRow}>
                    <Text style={styles.savedType}>{TYPE_LABEL[m.type]}</Text>
                    <Pressable
                      style={styles.savedValueWrap}
                      disabled={!launchUrl}
                      onPress={() => launchUrl && Linking.openURL(launchUrl).catch(() => {})}
                    >
                      <Text
                        style={[styles.savedValue, !!launchUrl && styles.savedValueLink]}
                        numberOfLines={1}
                      >
                        {m.value}
                      </Text>
                    </Pressable>
                    <Pressable style={styles.removeBtn} hitSlop={8} onPress={() => removeMethod(m.id)}>
                      <Text style={styles.removeBtnText}>×</Text>
                    </Pressable>
                  </View>
                );
              })}

              {add ? (
                <View style={styles.addBlock}>
                  <View style={styles.addRow}>
                    <Pressable
                      style={styles.typeDropdown}
                      onPress={() => setAddTypePickerOpen((v) => !v)}
                    >
                      <Text style={styles.typeDropdownText}>{TYPE_LABEL[add.type]}</Text>
                      <Text style={styles.typeDropdownCaret}>{addTypePickerOpen ? '▴' : '▾'}</Text>
                    </Pressable>
                    <TextInput
                      style={[fieldStyles.input, { flex: 1 }, !!addError && add.value.length > 0 && styles.inputErr]}
                      value={add.value}
                      onChangeText={setAddValue}
                      placeholder={add.type === 'email' ? 'name@example.com' : '555-555-5555'}
                      placeholderTextColor={colors.form.inputPlaceholder}
                      keyboardType={add.type === 'email' ? 'email-address' : isPhoneKind(add.type) ? 'phone-pad' : 'default'}
                      autoCapitalize="none"
                      autoFocus
                    />
                    <Pressable
                      style={[styles.checkBtn, !!addError && styles.checkBtnDisabled]}
                      onPress={confirmAdd}
                      disabled={!!addError}
                    >
                      <Text style={styles.checkBtnText}>✓</Text>
                    </Pressable>
                    <Pressable style={styles.removeBtn} onPress={cancelAdd}>
                      <Text style={styles.removeBtnText}>×</Text>
                    </Pressable>
                  </View>
                  {addTypePickerOpen && (
                    <View style={styles.typePicker}>
                      {METHOD_TYPES.map((t) => (
                        <Pressable
                          key={t}
                          style={[styles.typePickerItem, add.type === t && styles.typePickerItemActive]}
                          onPress={() => setAddType(t)}
                        >
                          <Text style={[styles.typePickerText, add.type === t && styles.typePickerTextActive]}>
                            {TYPE_LABEL[t]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {addError && add.value.length > 0 ? (
                    <Text style={styles.methodErr}>{addError}</Text>
                  ) : null}
                </View>
              ) : (
                <Pressable style={styles.addMethodBtn} onPress={startAdd}>
                  <Text style={styles.addMethodBtnText}>+ Add contact method</Text>
                </Pressable>
              )}
            </View>

            <Field
              label="Notes"
              value={draft.notes}
              onChange={(v) => setDraft({ ...draft, notes: v })}
              multiline
            />

            {!isNew && existing && (
              <>
                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>Upcoming</Text>
                  {upcomingEvents.length === 0 ? (
                    <Text style={styles.eventsEmpty}>Nothing scheduled.</Text>
                  ) : (
                    upcomingEvents.map((e) => (
                      <EventRow key={e.id} e={e} onPress={() => e.date && onOpenDay?.(e.date)} />
                    ))
                  )}
                </View>

                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>Past events</Text>
                  {pastEvents.length === 0 ? (
                    <Text style={styles.eventsEmpty}>No past events with this contact yet.</Text>
                  ) : (
                    pastEvents.map((e) => (
                      <EventRow key={e.id} e={e} onPress={() => e.date && onOpenDay?.(e.date)} />
                    ))
                  )}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            {!isNew && (
              <View style={styles.actionDelete}>
                <Button
                  label="Delete"
                  onPress={confirmAndDelete}
                  variant="destructiveGhost"
                  size="sm"
                />
              </View>
            )}
            <Button
              label="Cancel"
              onPress={handleClose}
              variant="ghost"
              size="sm"
            />
            <Button
              label="Save"
              onPress={handleSave}
              variant="primary"
              size="sm"
              disabled={!canSave}
              loading={saving}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}

interface EventRowItem {
  id: string;
  date: string;
  notes: string;
  amount: number | null;
  accountNames: string[];
}

function EventRow({ e, onPress }: { e: EventRowItem; onPress: () => void }) {
  return (
    <Pressable style={styles.eventRow} onPress={onPress}>
      <View style={styles.eventDateCol}>
        <Text style={styles.eventDate}>{e.date ? formatEventDate(e.date) : '—'}</Text>
      </View>
      <View style={styles.eventBody}>
        <Text style={styles.eventNotes} numberOfLines={2}>
          {e.notes || '(no note)'}
        </Text>
        {e.accountNames.length > 0 && (
          <Text style={styles.eventAcct} numberOfLines={1}>
            🏢 {e.accountNames.join(', ')}
          </Text>
        )}
      </View>
      {e.amount != null && (
        <Text style={styles.eventAmount}>
          ${e.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </Text>
      )}
    </Pressable>
  );
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Field({ label, value, onChange, multiline }: FieldProps) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.inputMulti]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholderTextColor={colors.form.inputPlaceholder}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  label: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
  input: {
    backgroundColor: colors.form.inputBg,
    borderWidth: 1,
    borderColor: colors.form.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.form.inputText,
    fontSize: typography.size.sm,
    minHeight: 38,
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

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
  scroll: { maxHeight: 560 },
  body: {
    padding: spacing[3],
    gap: spacing[3],
  },
  row2: { flexDirection: 'row', gap: spacing[2] },

  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
  },
  savedType: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    minWidth: 70,
  },
  savedValueWrap: { flex: 1, minWidth: 0 },
  savedValue: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  savedValueLink: {
    color: colors.text.link,
    textDecorationLine: 'underline',
  },

  addBlock: { gap: spacing[1] + 2 },
  addRow: { flexDirection: 'row', gap: spacing[1] + 2, alignItems: 'center' },
  typeDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[2] + 2,
    paddingVertical: spacing[2],
    borderWidth: 0.5,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    minWidth: 90,
  },
  typeDropdownText: {
    fontSize: typography.size.xs,
    color: colors.text.primary,
  },
  typeDropdownCaret: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  typePicker: {
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  typePickerItem: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border.muted,
  },
  typePickerItemActive: { backgroundColor: colors.status.todayBg },
  typePickerText: { fontSize: typography.size.sm, color: colors.text.primary },
  typePickerTextActive: { color: colors.status.todayText, fontWeight: typography.weight.medium },

  methodErr: { fontSize: typography.size.xs, color: colors.text.danger, marginTop: 2 },
  inputErr: { borderColor: colors.border.danger },

  checkBtn: {
    width: 32, height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.interactive.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  checkBtnDisabled: { opacity: 0.4 },
  checkBtnText: { color: '#fff', fontSize: 16, fontWeight: typography.weight.bold },

  removeBtn: {
    width: 32, height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  removeBtnText: { color: colors.text.secondary, fontSize: 18 },

  addMethodBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  addMethodBtnText: { color: colors.text.link, fontSize: typography.size.xs },

  eventsEmpty: {
    fontSize: typography.size.xs,
    color: colors.text.disabled,
    fontStyle: 'italic',
    paddingVertical: spacing[1],
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    marginBottom: spacing[1] + 2,
  },
  eventDateCol: { minWidth: 56 },
  eventDate: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: colors.text.primary,
  },
  eventBody: { flex: 1, minWidth: 0 },
  eventNotes: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  eventAcct: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  eventAmount: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.status.saleText,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing[2],
    padding: spacing[3],
    borderTopWidth: 0.5,
    borderTopColor: colors.border.muted,
    backgroundColor: colors.bg.surface,
    alignItems: 'center',
  },
  actionDelete: { marginRight: 'auto' },
});
