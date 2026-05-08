import React from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

interface PillProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  /** Visual tone — primary uses the brand blue, neutral keeps grayscale. */
  tone?: 'primary' | 'neutral';
  accessibilityLabel?: string;
}

/**
 * Small filter / segmented-control style chip. Used for type pickers,
 * follow-up presets, prospect filter, etc.
 */
export function Pill({ label, active, onPress, tone = 'primary', accessibilityLabel }: PillProps) {
  const Container: any = onPress ? Pressable : View;
  const activeBg = tone === 'primary' ? colors.interactive.primary : colors.bg.raised;
  const activeBorder = tone === 'primary' ? colors.interactive.primary : colors.border.default;
  const activeText = tone === 'primary' ? '#ffffff' : colors.text.primary;

  return (
    <Container
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!active } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={onPress ? 4 : undefined}
      style={[styles.base, active ? { backgroundColor: activeBg, borderColor: activeBorder } : null]}
    >
      <Text style={[styles.label, active ? { color: activeText, fontWeight: typography.weight.medium } : null]}>
        {label}
      </Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1.5],
    borderRadius: radius.full,
    backgroundColor: colors.bg.surface,
    borderWidth: 0.5,
    borderColor: colors.border.default,
  },
  label: {
    fontSize: typography.size.xs,
    color: colors.text.secondary,
  },
});
