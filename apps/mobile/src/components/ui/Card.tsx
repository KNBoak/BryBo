import React from 'react';
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, spacing, radius, shadows } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
  noPadding?: boolean;
}

export function Card({ children, onPress, style, raised = false, noPadding = false }: CardProps) {
  const containerStyle = [
    styles.base,
    raised ? styles.raised : styles.surface,
    noPadding ? undefined : styles.padding,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...containerStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    ...shadows.sm,
  },
  surface: {
    backgroundColor: colors.bg.surface,
  },
  raised: {
    backgroundColor: colors.bg.raised,
    ...shadows.md,
  },
  padding: {
    padding: spacing[4],
  },
  pressed: {
    opacity: 0.85,
  },
});
