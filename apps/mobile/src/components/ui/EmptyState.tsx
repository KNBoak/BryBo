import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[8],
    gap: spacing[2],
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.size.base,
    color: colors.text.disabled,
    textAlign: 'center',
    lineHeight: typography.size.base * 1.5,
  },
  action: {
    marginTop: spacing[4],
  },
});
