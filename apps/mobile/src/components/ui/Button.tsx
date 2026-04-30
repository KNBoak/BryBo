import React from 'react';
import { Text, Pressable, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantMap: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.interactive.primary, text: colors.interactive.primaryText },
  secondary: { bg: colors.interactive.secondary, text: colors.interactive.secondaryText },
  ghost: { bg: colors.interactive.ghost, text: colors.interactive.ghostText, border: colors.border.default },
  destructive: { bg: colors.interactive.destructive, text: colors.interactive.destructiveText },
};

const sizeMap: Record<ButtonSize, { px: number; py: number; font: number }> = {
  sm: { px: spacing[3], py: spacing[1] + 2, font: typography.size.sm },
  md: { px: spacing[4], py: spacing[2] + 2, font: typography.size.base },
  lg: { px: spacing[6], py: spacing[3], font: typography.size.md },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
}: ButtonProps) {
  const v = variantMap[variant];
  const s = sizeMap[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? colors.interactive.primaryHover : v.bg,
          paddingHorizontal: s.px,
          paddingVertical: s.py,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? 'transparent',
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
      ]}
    >
      <View style={styles.inner}>
        {loading && <ActivityIndicator size="small" color={v.text} style={styles.spinner} />}
        <Text style={[styles.label, { color: v.text, fontSize: s.font }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  label: {
    fontWeight: typography.weight.semibold,
  },
  spinner: {
    marginRight: spacing[1],
  },
});
