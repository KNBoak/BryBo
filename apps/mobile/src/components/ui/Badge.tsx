import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

type BadgeVariant = 'prospect' | 'customer' | 'cancelled' | 'sale' | 'today' | 'default';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { bg: string; text: string }> = {
  prospect: { bg: colors.status.prospectBg, text: colors.status.prospectText },
  customer: { bg: colors.status.customerBg, text: colors.status.customerText },
  cancelled: { bg: colors.status.cancelledBg, text: colors.status.cancelledText },
  sale: { bg: colors.status.saleBg, text: colors.status.saleText },
  today: { bg: colors.status.todayBg, text: colors.status.todayText },
  default: { bg: colors.bg.raised, text: colors.text.secondary },
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.label, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1] - 1,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
