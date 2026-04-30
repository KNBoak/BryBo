import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

interface SpinnerProps {
  size?: 'small' | 'large';
  style?: object;
}

export function Spinner({ size = 'small', style }: SpinnerProps) {
  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={colors.interactive.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
});
