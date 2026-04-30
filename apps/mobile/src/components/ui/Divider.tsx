import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../theme';

interface DividerProps {
  indent?: number;
}

export function Divider({ indent = 0 }: DividerProps) {
  return <View style={[styles.line, { marginLeft: indent }]} />;
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.muted,
    marginVertical: spacing[1],
  },
});
