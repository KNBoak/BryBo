import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, Alert, Linking, Platform } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { useDataStore } from '../../stores/dataStore';
import { generateId } from '../../utils/ids';
import { logError } from '../../utils/debug';
import { formatPhone, isValidPhone } from '../../utils/validation';
import { isVisibleEventDate } from '../../utils/dateCutoff';
import { Button } from '../../components/ui';
import type { Account, AccountAddress } from '@brybo/shared';
import { today as todayIso } from '@brybo/shared';

interface Props {
  visible: boolean;
  accountId: string | null; // null = new
  onClose: () => void;
  onSaved?: (id: string) => void;
  onOpenContact?: (id: string) => void;
  onAddContact?: (accountId: string) => void;
  onOpenDay?: (dateIso: string) => void;
  onAddEvent?: (accountId: string) => void;
}

const TAG = 'AccountDetailModal';

const EMPTY_DRAFT = {
  name: '',
  city: '',
  state: '',
  addresses: [] as AccountAddress[],
  phone: '',
  website: '',
  notes: '',
  is_prospect: true,
  primary_contact_id: null as string | null,
};

export function AccountDetailModal({ visible, accountId, onClose, onSaved, onOpenContact, onAddContact, onOpenDay, onAddEvent }: Props) {
  const accounts = useDataStore((s) => s.accounts);
  const contacts = useDataStore((s) => s.contacts);
  const contactMethods = useDataStore((s) => s.contactMethods);
  const events = useDataStore((s) => s.events);
  const eventAccounts = useDataStore((s) => s.eventAccounts);
  const days = useDataStore((s) => s.days);
  const activeUserId = useDataStore((s) => s.activeUserId);
  const upsertAccount = useDataStore((s) => s.upsertAccount);
  const deleteAccount = useDataStore((s) => s.deleteAccount);

  // localId tracks the active record in this modal — starts as accountId, then
  // flips to the newly-assigned id after a "new" save so subsequent edits stay
  // bound to the same record without closing the modal.
  const [localId, setLocalId] = useState<string | null>(accountId);
  useEffect(() => { if (visible) setLocalId(accountId); }, [visible, accountId]);
  const isNew = localId == null;
  const existing = !isNew ? accounts.find((a) => a.id === localId) ?? null : null;

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  // Re-init draft when the modal opens or the active record changes.
  useEffect(() => {
    if (!visible) return;
    setExpanded(false);
    setNotesExpanded(false);
    if (isNew) {
      setDraft(EMPTY_DRAFT);
    } else if (existing) {
      setDraft({
        name: existing.name,
        city: existing.city ?? '',
        state: existing.state ?? '',
        addresses: existing.addresses ?? [],
        phone: existing.phone ?? '',
        website: existing.website ?? '',
        notes: existing.notes ?? '',
        is_prospect: existing.is_prospect ?? true,
        primary_contact_id: existing.primary_contact_id ?? null,
      });
    }
  }, [visible, isNew, existing?.id]);

  // Snapshot of the persisted state, used for dirty detection.
  const expected = useMemo(() => {
    if (existing) return {
      name: existing.name,
      city: existing.city ?? '',
      state: existing.state ?? '',
      addresses: existing.addresses ?? [],
      phone: existing.phone ?? '',
      website: existing.website ?? '',
      notes: existing.notes ?? '',
      is_prospect: existing.is_prospect ?? true,
      primary_contact_id: existing.primary_contact_id ?? null,
    };
    return EMPTY_DRAFT;
  }, [existing]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(expected);

  const phoneError =
    draft.phone.length > 0 && !isValidPhone(draft.phone) ? 'Use ###-###-####' : null;
  const canSave =
    draft.name.trim().length > 0 && !!activeUserId && !phoneError && dirty;

  // Sales totals — derived from events linked to this account.
  // Intentionally aggregates the full event history (no display-cutoff filter):
  // these totals span all years and are the spec's carve-out for the cutoff rule.
  const totalSales = useMemo(() => {
    if (!existing) return 0;
    const eventIds = new Set(
      eventAccounts.filter((ea) => ea.account_id === existing.id).map((ea) => ea.event_id),
    );
    return events.reduce((sum, e) => {
      if (!eventIds.has(e.id)) return sum;
      if (e.is_cancelled) return sum;
      if (e.amount == null) return sum;
      return sum + e.amount;
    }, 0);
  }, [existing, events, eventAccounts]);

  // Events linked to this account, split into upcoming + past.
  const { upcomingEvents, pastEvents } = useMemo(() => {
    if (!existing) return { upcomingEvents: [], pastEvents: [] };
    const myEventIds = new Set(
      eventAccounts.filter((ea) => ea.account_id === existing.id).map((ea) => ea.event_id),
    );
    const dayDateById = new Map(days.map((d) => [d.id, d.date]));
    const projected = events
      .filter((e) => myEventIds.has(e.id) && !e.is_cancelled)
      .map((e) => ({
        id: e.id,
        date: dayDateById.get(e.day_id) ?? '',
        notes: e.notes ?? '',
        amount: e.amount,
      }))
      .filter((e) => isVisibleEventDate(e.date));
    const todayStr = todayIso();
    const upcoming = projected
      .filter((e) => e.date && e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date));
    const past = projected
      .filter((e) => !e.date || e.date < todayStr)
      .sort((a, b) => b.date.localeCompare(a.date));
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [existing, events, eventAccounts, days]);

  const ytdSales = useMemo(() => {
    if (!existing) return 0;
    const year = todayIso().slice(0, 4);
    const eventIds = new Set(
      eventAccounts.filter((ea) => ea.account_id === existing.id).map((ea) => ea.event_id),
    );
    const dayDateById = new Map(days.map((d) => [d.id, d.date]));
    return events.reduce((sum, e) => {
      if (!eventIds.has(e.id)) return sum;
      if (e.is_cancelled || e.amount == null) return sum;
      const date = dayDateById.get(e.day_id);
      if (!date || !date.startsWith(year + '-')) return sum;
      return sum + e.amount;
    }, 0);
  }, [existing, events, eventAccounts, days]);


  const handleSave = async () => {
    if (!canSave || !activeUserId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const account: Account = {
        id: existing?.id ?? generateId(),
        user_id: activeUserId,
        name: draft.name.trim(),
        city: draft.city.trim() || null,
        state: draft.state.trim() || null,
        addresses: draft.addresses,
        phone: draft.phone.trim() || null,
        website: draft.website.trim() || null,
        notes: draft.notes.trim() || null,
        is_prospect: draft.is_prospect,
        primary_contact_id: draft.primary_contact_id,
        created_at: existing?.created_at ?? now,
        updated_at: now,
      };
      await upsertAccount(account);
      // If the parent supplied onSaved, it expects to navigate (e.g. select-on-save) —
      // honor that. Otherwise, stay open and just bind the modal to the new id.
      if (onSaved) onSaved(account.id);
      else if (isNew) setLocalId(account.id);
    } catch (e) {
      logError(TAG, 'handleSave threw', e);
    } finally {
      setSaving(false);
    }
  };

  const confirmAndDelete = () => {
    if (!existing) return;
    Alert.alert(
      `Delete "${existing.name}"?`,
      'This removes the account and unlinks it from any contacts and events. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(existing.id);
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>
            {isNew ? 'New account' : existing?.name ?? 'Account'}
          </Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

            <View style={styles.summaryRow}>
              <Pressable
                style={[styles.statusBadge, draft.is_prospect ? styles.statusProspect : styles.statusCustomer]}
                onPress={() => setDraft({ ...draft, is_prospect: !draft.is_prospect })}
              >
                <Text style={[styles.statusBadgeText, draft.is_prospect ? styles.statusProspectText : styles.statusCustomerText]}>
                  {draft.is_prospect ? '🌱 Prospect' : '🏆 Customer'}
                </Text>
              </Pressable>
              {!isNew && existing && (
                <View style={styles.salesGroup}>
                  <View style={styles.salesItem}>
                    <Text style={styles.salesLabel}>YTD</Text>
                    <Text style={styles.salesValue}>{formatMoney(ytdSales)}</Text>
                  </View>
                  <View style={styles.salesDivider} />
                  <View style={styles.salesItem}>
                    <Text style={styles.salesLabel}>All time</Text>
                    <Text style={styles.salesValue}>{formatMoney(totalSales)}</Text>
                  </View>
                </View>
              )}
            </View>

            <Field label="Name *" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />

            <AddressesEditor
              addresses={draft.addresses}
              onChange={(next) => setDraft({ ...draft, addresses: next })}
            />

            <Pressable style={styles.expandToggle} onPress={() => setExpanded((v) => !v)}>
              <Text style={styles.expandToggleText}>
                {expanded ? '▾ Hide details' : '▸ More details (phone, website…)'}
              </Text>
            </Pressable>

            {expanded && (
              <>
                <Field label="City" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} />
                <Field label="State / Province" value={draft.state} onChange={(v) => setDraft({ ...draft, state: v })} />
                <Field
                  label="Phone"
                  value={draft.phone}
                  onChange={(v) => setDraft({ ...draft, phone: formatPhone(v) })}
                  keyboardType="phone-pad"
                  error={phoneError}
                />
                <Field label="Website" value={draft.website} onChange={(v) => setDraft({ ...draft, website: v })} autoCapitalize="none" />
              </>
            )}

            <Pressable style={styles.expandToggle} onPress={() => setNotesExpanded((v) => !v)}>
              <Text style={styles.expandToggleText}>
                {notesExpanded ? '▾ Hide notes' : `▸ Notes${draft.notes.trim().length > 0 ? '  ●' : ''}`}
              </Text>
            </Pressable>
            {notesExpanded && (
              <Field
                label="Notes"
                value={draft.notes}
                onChange={(v) => setDraft({ ...draft, notes: v })}
                multiline
              />
            )}

            {!isNew && existing && (
              <View style={fieldStyles.wrap}>
                <Text style={fieldStyles.label}>Contacts</Text>
                {(() => {
                  const linkedContacts = contacts.filter(
                    (c) => c.user_id === activeUserId && c.account_id === existing.id,
                  );
                  if (linkedContacts.length === 0) {
                    return <Text style={styles.contactsEmpty}>No linked contacts yet.</Text>;
                  }
                  return linkedContacts.map((c) => {
                    const cell = contactMethods.find(
                      (m) => m.contact_id === c.id && m.type === 'cell',
                    );
                    const fullName = `${c.first_name} ${c.last_name}`.trim() || '—';
                    const isPrimary = draft.primary_contact_id === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        style={styles.contactRow}
                        onPress={() => onOpenContact?.(c.id)}
                      >
                        <Text style={styles.contactIcon}>👤</Text>
                        <Text style={styles.contactName} numberOfLines={1}>{fullName}</Text>
                        {cell ? <Text style={styles.contactCell}>{cell.value}</Text> : null}
                        <Pressable
                          style={[styles.primaryStar, isPrimary && styles.primaryStarActive]}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={isPrimary ? 'Unmark as primary contact' : 'Mark as primary contact'}
                          onPress={(e) => {
                            e.stopPropagation();
                            setDraft({
                              ...draft,
                              primary_contact_id: isPrimary ? null : c.id,
                            });
                          }}
                        >
                          <Text style={[styles.primaryStarText, isPrimary && styles.primaryStarTextActive]}>★</Text>
                        </Pressable>
                      </Pressable>
                    );
                  });
                })()}
                {onAddContact ? (
                  <Pressable
                    style={styles.addContactBtn}
                    onPress={() => onAddContact(existing.id)}
                  >
                    <Text style={styles.addContactBtnText}>+ Add contact</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {!isNew && existing && (
              <>
                <View style={fieldStyles.wrap}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={fieldStyles.label}>Upcoming</Text>
                    {onAddEvent ? (
                      <Pressable
                        style={styles.addContactBtn}
                        onPress={() => onAddEvent(existing.id)}
                      >
                        <Text style={styles.addContactBtnText}>+ Add event</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  {upcomingEvents.length === 0 ? (
                    <Text style={styles.contactsEmpty}>Nothing scheduled.</Text>
                  ) : (
                    upcomingEvents.map((e) => (
                      <EventRow key={e.id} e={e} onPress={() => e.date && onOpenDay?.(e.date)} />
                    ))
                  )}
                </View>

                <View style={fieldStyles.wrap}>
                  <Text style={fieldStyles.label}>Past events</Text>
                  {pastEvents.length === 0 ? (
                    <Text style={styles.contactsEmpty}>No past events with this account yet.</Text>
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

function formatMoney(n: number): string {
  if (n === 0) return '$0';
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatEventDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface EventRowItem {
  id: string;
  date: string;
  notes: string;
  amount: number | null;
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
      </View>
      {e.amount != null && (
        <Text style={styles.eventAmount}>
          ${e.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </Text>
      )}
    </Pressable>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string | null;
  placeholder?: string;
}

function Field({ label, value, onChange, multiline, keyboardType, autoCapitalize, error, placeholder }: FieldProps) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.inputMulti, !!error && fieldStyles.inputErr]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        placeholder={placeholder}
        placeholderTextColor={colors.form.inputPlaceholder}
      />
      {error ? <Text style={fieldStyles.err}>{error}</Text> : null}
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
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputErr: { borderColor: colors.border.danger },
  err: {
    fontSize: typography.size.xs,
    color: colors.text.danger,
    marginTop: 2,
  },
});

function AddressesEditor(props: {
  addresses: AccountAddress[];
  onChange: (next: AccountAddress[]) => void;
}) {
  const { addresses, onChange } = props;
  const [adding, setAdding] = useState(false);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftValue, setDraftValue] = useState('');

  const reset = () => { setAdding(false); setDraftLabel(''); setDraftValue(''); };
  const canSaveAdd = draftValue.trim().length > 0;

  const saveAdd = () => {
    if (!canSaveAdd) return;
    const next: AccountAddress = {
      id: generateId(),
      label: draftLabel.trim() || null,
      address: draftValue.trim(),
      is_primary: addresses.length === 0,
      latitude: null,
      longitude: null,
    };
    onChange([...addresses, next]);
    reset();
  };

  const removeAt = (id: string) => {
    onChange(addresses.filter((a) => a.id !== id));
  };

  const openInMaps = async (address: string) => {
    const q = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps://?q=${q}`,
      android: `geo:0,0?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    })!;
    const canOpen = await Linking.canOpenURL(url).catch(() => false);
    if (!canOpen) {
      // Fall back to a universal URL on devices without a native maps app.
      const fallback = `https://www.google.com/maps/search/?api=1&query=${q}`;
      const fbOk = await Linking.canOpenURL(fallback).catch(() => false);
      if (!fbOk) {
        Alert.alert('No map app', 'Could not open this address — no map app is available.');
        return;
      }
      await Linking.openURL(fallback).catch(() => {
        Alert.alert('Could not open address', 'The map app rejected the request.');
      });
      return;
    }
    await Linking.openURL(url).catch(() => {
      Alert.alert('Could not open address', 'The map app rejected the request.');
    });
  };

  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>Addresses</Text>

      {addresses.length === 0 && !adding ? (
        <Text style={addrStyles.empty}>No addresses yet.</Text>
      ) : null}

      {addresses.map((a) => (
        <View key={a.id} style={addrStyles.row}>
          <Pressable
            style={addrStyles.openBtn}
            hitSlop={8}
            onPress={() => openInMaps(a.address)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${a.address} in maps`}
          >
            <Text style={addrStyles.openBtnText}>📍</Text>
          </Pressable>
          <View style={addrStyles.body}>
            {a.label ? <Text style={addrStyles.label}>{a.label}</Text> : null}
            <Text style={addrStyles.value} numberOfLines={2}>{a.address}</Text>
          </View>
          <Pressable
            style={addrStyles.removeBtn}
            hitSlop={8}
            onPress={() => removeAt(a.id)}
            accessibilityRole="button"
            accessibilityLabel="Remove address"
          >
            <Text style={addrStyles.removeBtnText}>×</Text>
          </Pressable>
        </View>
      ))}

      {adding ? (
        <View style={addrStyles.addBlock}>
          <Field
            label="Label (optional)"
            value={draftLabel}
            onChange={setDraftLabel}
            placeholder="Head office"
          />
          <Field
            label="Address"
            value={draftValue}
            onChange={setDraftValue}
            placeholder="123 Main St, Kitchener, ON"
          />
          <View style={addrStyles.addRow}>
            <Pressable style={addrStyles.cancelBtn} onPress={reset}>
              <Text style={addrStyles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[addrStyles.saveBtn, !canSaveAdd && addrStyles.saveBtnDisabled]}
              disabled={!canSaveAdd}
              onPress={saveAdd}
            >
              <Text style={[addrStyles.saveBtnText, !canSaveAdd && addrStyles.saveBtnTextDisabled]}>
                Add
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={addrStyles.addPill} onPress={() => setAdding(true)}>
          <Text style={addrStyles.addPillText}>+ Add address</Text>
        </Pressable>
      )}
    </View>
  );
}

const addrStyles = StyleSheet.create({
  empty: {
    fontSize: typography.size.sm,
    color: colors.text.disabled,
    paddingHorizontal: spacing[1],
    paddingVertical: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderWidth: 0.5,
    borderColor: colors.border.muted,
    borderRadius: radius.sm,
    backgroundColor: colors.bg.surface,
    marginTop: spacing[1] + 2,
  },
  openBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.status.todayBg,
  },
  openBtnText: {
    fontSize: typography.size.base,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
  value: {
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  removeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: colors.text.secondary,
    fontSize: 18,
  },
  addPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    marginTop: spacing[2],
  },
  addPillText: {
    color: colors.text.link,
    fontSize: typography.size.xs,
  },
  addBlock: {
    marginTop: spacing[2],
    gap: spacing[2],
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing[2],
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  cancelBtnText: {
    color: colors.text.secondary,
    fontSize: typography.size.sm,
  },
  saveBtn: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.interactive.primary,
  },
  saveBtnDisabled: {
    backgroundColor: colors.bg.raised,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  saveBtnTextDisabled: {
    color: colors.text.disabled,
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
    maxHeight: '85%',
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
  scroll: { maxHeight: 480 },
  body: {
    padding: spacing[3],
    gap: spacing[3],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  statusBadge: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    borderWidth: 0.5,
  },
  statusProspect: {
    backgroundColor: colors.status.prospectBg,
    borderColor: colors.status.prospectText,
  },
  statusCustomer: {
    backgroundColor: colors.status.customerBg,
    borderColor: colors.status.customerText,
  },
  statusBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  statusProspectText: { color: colors.status.prospectText },
  statusCustomerText: { color: colors.status.customerText },
  salesGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing[3],
  },
  salesItem: { alignItems: 'flex-end' },
  salesLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  salesValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  salesDivider: {
    width: 0.5,
    height: 24,
    backgroundColor: colors.border.muted,
  },
  expandToggle: {
    paddingVertical: spacing[1],
    alignSelf: 'flex-start',
  },
  expandToggleText: {
    color: colors.text.link,
    fontSize: typography.size.xs,
  },
  contactsEmpty: {
    fontSize: typography.size.xs,
    color: colors.text.disabled,
    fontStyle: 'italic',
    paddingVertical: spacing[1],
  },
  contactRow: {
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
  contactIcon: { fontSize: 14 },
  contactName: {
    flex: 1,
    fontSize: typography.size.sm,
    color: colors.text.primary,
  },
  contactCell: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
  primaryStar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryStarActive: {
    backgroundColor: colors.status.todayBg,
  },
  primaryStarText: {
    color: colors.text.disabled,
    fontSize: typography.size.base,
  },
  primaryStarTextActive: {
    color: colors.status.todayText,
  },
  addContactBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1] + 2,
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    marginTop: spacing[1],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addContactBtnText: { color: colors.text.link, fontSize: typography.size.xs },

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
  actionDelete: {
    marginRight: 'auto',
  },
});
