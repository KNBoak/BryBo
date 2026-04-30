import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

export function AiSummaryStub() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>AI DAILY SUMMARY</Text>
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonText}>COMING SOON</Text>
        </View>
      </View>
      <Text style={styles.body}>
        An AI-powered summary of your day will appear here — accounts to visit,
        key contacts, notes to review, and open opportunities.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.status.todayBg,
    borderRadius: radius.lg,
    padding: spacing[4],
    marginHorizontal: spacing[4],
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: colors.status.todayText,
    letterSpacing: 1,
  },
  comingSoon: {
    backgroundColor: colors.bg.overlay,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  comingSoonText: {
    fontSize: typography.size.xs - 1,
    color: colors.text.secondary,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.5,
  },
  body: {
    fontSize: typography.size.sm,
    color: colors.status.todayText,
    lineHeight: typography.size.sm * 1.6,
    opacity: 0.85,
  },
});
