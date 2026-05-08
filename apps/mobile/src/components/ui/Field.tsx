import React from 'react';
import { Text, TextInput, View, StyleSheet, type TextInputProps } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

type KeyboardType = NonNullable<TextInputProps['keyboardType']>;
type AutoCapitalize = NonNullable<TextInputProps['autoCapitalize']>;

interface FieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardType;
  autoCapitalize?: AutoCapitalize;
  autoCorrect?: boolean;
  error?: string | null;
  helper?: string;
  required?: boolean;
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  error,
  helper,
  required,
}: FieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        style={[
          styles.input,
          multiline && styles.inputMulti,
          !!error && styles.inputErr,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.form.inputPlaceholder}
        multiline={multiline}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={autoCorrect}
      />
      {error ? (
        <Text style={styles.err}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[1] },
  label: {
    fontSize: typography.size.xs,
    color: colors.form.labelText,
    fontWeight: typography.weight.medium,
    letterSpacing: typography.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  required: { color: colors.text.danger },
  input: {
    backgroundColor: colors.form.inputBg,
    borderWidth: 1,
    borderColor: colors.form.inputBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2.5],
    color: colors.form.inputText,
    fontSize: typography.size.sm,
  },
  inputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: spacing[2.5],
  },
  inputErr: { borderColor: colors.form.errorBorder },
  err: {
    fontSize: typography.size.xs,
    color: colors.form.errorText,
    marginTop: spacing[0.5],
  },
  helper: {
    fontSize: typography.size.xs,
    color: colors.form.helperText,
    marginTop: spacing[0.5],
  },
});
