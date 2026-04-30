import React from 'react';
import { TextInput, Text, View, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric' | 'url';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  editable?: boolean;
  returnKeyType?: 'done' | 'next' | 'go' | 'search';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  multiline = false,
  numberOfLines,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  editable = true,
  returnKeyType,
  onSubmitEditing,
  inputRef,
}: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.form.inputPlaceholder}
        multiline={multiline}
        numberOfLines={numberOfLines}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secureTextEntry}
        editable={editable}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[
          styles.input,
          multiline && styles.multiline,
          error ? styles.inputError : styles.inputDefault,
          !editable && styles.inputDisabled,
        ]}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[1],
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.form.labelText,
  },
  input: {
    backgroundColor: colors.form.inputBg,
    color: colors.form.inputText,
    fontSize: typography.size.base,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2] + 2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  inputDefault: {
    borderColor: colors.form.inputBorder,
  },
  inputError: {
    borderColor: colors.form.errorBorder,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing[2] + 2,
  },
  errorText: {
    fontSize: typography.size.xs,
    color: colors.form.errorText,
  },
});
