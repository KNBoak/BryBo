import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

type TagTone = 'account' | 'contact' | 'sale' | 'today' | 'cancelled' | 'neutral';

interface TagProps {
  label: string;
  tone?: TagTone;
  onPress?: () => void;
  /** Show a trailing × to suggest the tag can be removed. Implies onPress. */
  removable?: boolean;
  accessibilityLabel?: string;
}

const TONES: Record<TagTone, { bg: string; text: string }> = {
  account:   { bg: colors.status.todayBg,     text: colors.status.todayText },
  contact:   { bg: colors.status.customerBg,  text: colors.status.customerText },
  sale:      { bg: colors.status.saleBg,      text: colors.status.saleText },
  today:     { bg: colors.status.todayBg,     text: colors.status.todayText },
  cancelled: { bg: colors.status.cancelledBg, text: colors.status.cancelledText },
  neutral:   { bg: colors.bg.raised,          text: colors.text.secondary },
};

/**
 * Compact pill that represents an entity link (account/contact), a sale chip,
 * etc. Inherits the dark surface treatment with semantic background tints.
 */
export function Tag({ label, tone = 'neutral', onPress, removable, accessibilityLabel }: TagProps) {
  const t = TONES[tone];
  const showX = removable && !!onPress;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={showX ? 'Removes this tag' : undefined}
      hitSlop={onPress ? 4 : undefined}
      style={[styles.base, { backgroundColor: t.bg }]}
    >
      <Text style={[styles.label, { color: t.text }]} numberOfLines={1}>
        {label}{showX ? '  ×' : ''}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius.full,
    flexShrink: 1,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
