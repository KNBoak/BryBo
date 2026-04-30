import React from 'react';
import { Text, View, Pressable, StyleSheet, Linking, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, radius, typography } from '../../theme';
import type { ContactMethod } from '@brybo/shared';
import { Badge } from './Badge';

interface ContactMethodRowProps {
  method: ContactMethod;
}

const typeLabels: Record<string, string> = {
  cell: 'Cell',
  email: 'Email',
  work: 'Work',
  home: 'Home',
  other: 'Other',
};

export function ContactMethodRow({ method }: ContactMethodRowProps) {
  const handlePress = async () => {
    try {
      if (method.type === 'email') {
        await Linking.openURL(`mailto:${method.value}`);
      } else if (method.type === 'cell' || method.type === 'work' || method.type === 'home') {
        await Linking.openURL(`tel:${method.value}`);
      } else {
        await Clipboard.setStringAsync(method.value);
        Alert.alert('Copied', 'Value copied to clipboard');
      }
    } catch {
      await Clipboard.setStringAsync(method.value);
      Alert.alert('Copied', 'Value copied to clipboard');
    }
  };

  const handleLongPress = async () => {
    await Clipboard.setStringAsync(method.value);
    Alert.alert('Copied', 'Value copied to clipboard');
  };

  return (
    <Pressable onPress={handlePress} onLongPress={handleLongPress} style={styles.row}>
      <View style={styles.left}>
        <Badge label={method.label ?? typeLabels[method.type] ?? method.type} />
        {method.is_primary && <Text style={styles.primaryDot}>●</Text>}
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {method.value}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[2],
    gap: spacing[3],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexShrink: 0,
  },
  primaryDot: {
    color: colors.interactive.primary,
    fontSize: typography.size.xs,
  },
  value: {
    color: colors.text.link,
    fontSize: typography.size.base,
    flex: 1,
    textAlign: 'right',
  },
});
