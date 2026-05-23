import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, TextInput, Linking, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';
import { getApiKey, setApiKey, clearApiKey } from '../../utils/apiKeyStore';
import { logError } from '../../utils/debug';
import { Button } from '../../components/ui';

const TAG = 'AiSettingsModal';
const KEYS_URL = 'https://console.anthropic.com/settings/keys';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AiSettingsModal({ visible, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState('');
  const [original, setOriginal] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShowKey(false);
    setSaving(false);
    (async () => {
      const k = (await getApiKey()) ?? '';
      setOriginal(k);
      setDraft(k);
    })();
  }, [visible]);

  const dirty = draft.trim() !== original;
  const canSave = draft.trim().length > 0 && dirty;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await setApiKey(draft.trim());
      setOriginal(draft.trim());
      onSaved?.();
      onClose();
    } catch (e) {
      logError(TAG, 'save threw', e);
    } finally {
      setSaving(false);
    }
  };

  const confirmAndClear = () => {
    Alert.alert(
      'Clear API key?',
      'AI Assist will be disabled until you paste a new key.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearApiKey();
            setDraft('');
            setOriginal('');
            onClose();
          },
        },
      ],
    );
  };

  const handleClose = () => {
    if (!dirty) { onClose(); return; }
    Alert.alert(
      'Discard changes?',
      'Your unsaved key will not be applied.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Anthropic API key</Text>

          <View style={styles.body}>
            <Text style={styles.help}>
              AI Assist calls Claude directly from this device. Paste an Anthropic API key to enable it.
              The key is stored encrypted in your device's secure storage.
            </Text>

            <Pressable onPress={() => Linking.openURL(KEYS_URL).catch(() => {})}>
              <Text style={styles.link}>Get a key at console.anthropic.com →</Text>
            </Pressable>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>API key</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="sk-ant-..."
                  placeholderTextColor={colors.form.inputPlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showKey}
                />
                <Pressable style={styles.eyeBtn} onPress={() => setShowKey((v) => !v)}>
                  <Text style={styles.eyeBtnText}>{showKey ? 'hide' : 'show'}</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.actions}>
            {original.length > 0 && (
              <View style={styles.actionDelete}>
                <Button
                  label="Clear key"
                  onPress={confirmAndClear}
                  variant="destructiveGhost"
                  size="sm"
                />
              </View>
            )}
            <Button label="Cancel" onPress={handleClose} variant="ghost" size="sm" />
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
  body: { padding: spacing[3], gap: spacing[3] },
  help: {
    fontSize: typography.size.sm,
    color: colors.text.secondary,
    lineHeight: typography.size.sm * 1.4,
  },
  link: {
    fontSize: typography.size.sm,
    color: colors.text.link,
    textDecorationLine: 'underline',
  },
  fieldWrap: { gap: spacing[1] },
  fieldLabel: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
    fontWeight: typography.weight.medium,
  },
  inputRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.form.inputBg,
    borderWidth: 1,
    borderColor: colors.form.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    color: colors.form.inputText,
    fontSize: typography.size.sm,
    fontFamily: 'monospace',
  },
  eyeBtn: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  eyeBtnText: { color: colors.text.link, fontSize: typography.size.xs },
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
